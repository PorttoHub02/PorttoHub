import Redis from 'ioredis';

export interface CacheStats {
  provider: 'upstash-redis-rest' | 'redis-server' | 'in-memory-redis';
  connected: boolean;
  totalKeys: number;
  hitCount: number;
  missCount: number;
  hitRatio: string;
  totalRequests: number;
  avgLatencyMs: number;
  lastConnectedAt?: string;
  keysSummary: Record<string, number>;
  upstashConfigured?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
  total: number;
}

export interface AutorizadoCacheItem {
  id: string;
  condominioId: string;
  name: string;
  unit: string;
  type: string;
  status: 'Ativo' | 'Bloqueado';
  document: string;
  phone?: string;
  photoUrl?: string;
  updatedAt: string;
}

// Emulador In-Memory de ultra-alta performance com semântica Redis (TTL + LRU Cache Limitado)
class InMemoryRedisStore {
  private store = new Map<string, { value: string; expiresAt?: number; tags?: string[] }>();
  private tagIndex = new Map<string, Set<string>>();
  private rateLimitStore = new Map<string, { count: number; resetAt: number }>();
  private readonly maxCapacity: number;

  constructor(maxCapacity: number = 5000) {
    this.maxCapacity = maxCapacity;

    // Pruning periódico em segundo plano para liberar memória de chaves expiradas (a cada 60s)
    if (typeof setInterval !== 'undefined') {
      const timer = setInterval(() => {
        this.pruneExpired();
      }, 60000);
      if (timer.unref) timer.unref();
    }
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.del(key);
      }
    }
    for (const [key, entry] of this.rateLimitStore.entries()) {
      if (now > entry.resetAt) {
        this.rateLimitStore.delete(key);
      }
    }
  }

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.del(key);
      return null;
    }
    // LRU refresh: move para o final da ordem de iteração do Map
    this.store.delete(key);
    this.store.set(key, entry);
    return entry.value;
  }

  set(key: string, value: string, mode?: string, duration?: number, tags?: string[]): string {
    let expiresAt: number | undefined;
    if (mode === 'EX' && duration && duration > 0) {
      expiresAt = Date.now() + duration * 1000;
    }

    // Se atingiu capacidade máxima, descarta a chave mais antiga (LRU eviction)
    if (this.store.size >= this.maxCapacity && !this.store.has(key)) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) {
        this.del(oldestKey);
      }
    }

    this.store.delete(key);
    this.store.set(key, { value, expiresAt, tags });

    if (tags && tags.length > 0) {
      for (const tag of tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
    }
    return 'OK';
  }

  del(key: string): number {
    const entry = this.store.get(key);
    if (entry && entry.tags) {
      for (const tag of entry.tags) {
        this.tagIndex.get(tag)?.delete(key);
      }
    }
    return this.store.delete(key) ? 1 : 0;
  }

  delByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys || keys.size === 0) return 0;
    let count = 0;
    for (const k of Array.from(keys)) {
      if (this.del(k)) count++;
    }
    this.tagIndex.delete(tag);
    return count;
  }

  keys(pattern: string): string[] {
    const now = Date.now();
    const result: string[] = [];
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const [key, entry] of this.store.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.del(key);
        continue;
      }
      if (regex.test(key)) {
        result.push(key);
      }
    }
    return result;
  }

  checkRateLimit(key: string, maxRequests: number, windowSeconds: number): RateLimitResult {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    let entry = this.rateLimitStore.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      this.rateLimitStore.set(key, entry);
      return {
        allowed: true,
        remaining: maxRequests - 1,
        resetSeconds: windowSeconds,
        total: 1
      };
    }

    entry.count++;
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    const allowed = entry.count <= maxRequests;
    const remaining = Math.max(0, maxRequests - entry.count);

    return {
      allowed,
      remaining,
      resetSeconds,
      total: entry.count
    };
  }

  flushdb(): string {
    this.store.clear();
    this.tagIndex.clear();
    this.rateLimitStore.clear();
    return 'OK';
  }

  size(): number {
    return this.store.size;
  }
}

class RedisCacheManager {
  private redis: Redis | null = null;
  private memoryFallback = new InMemoryRedisStore();
  private isConnected = false;
  private hitCount = 0;
  private missCount = 0;
  private totalRequests = 0;
  private totalLatencyMs = 0;
  private lastConnectedAt?: string;

  // Upstash Redis REST Config
  private upstashRestUrl: string = '';
  private upstashRestToken: string = '';
  private hasUpstash: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    // 1. Detecta configuração Upstash Redis REST (alta performance, edge & serverless compatível)
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (upstashUrl && upstashToken) {
      this.upstashRestUrl = upstashUrl.replace(/\/+$/, '');
      this.upstashRestToken = upstashToken;
      this.hasUpstash = true;
      this.isConnected = true;
      this.lastConnectedAt = new Date().toISOString();
      console.log('⚡ [Upstash Redis REST] Conexão HTTP REST Edge inicializada com sucesso.');
      return;
    }

    // 2. Fallback para conexão ioredis TCP tradicional (se fornecida e ambiente permitir)
    const redisUrl = process.env.REDIS_URL || process.env.REDISCLOUD_URL;
    if (redisUrl) {
      try {
        console.log('[Redis] Tentando conectar ao Redis remoto:', redisUrl.replace(/:[^:@]+@/, ':***@'));
        this.redis = new Redis(redisUrl, {
          connectTimeout: 4000,
          maxRetriesPerRequest: 1,
          retryStrategy: (times) => {
            if (times > 2) {
              console.warn('[Redis] Conexão remota não disponível no sandbox, ativando motor In-Memory Redis...');
              return null;
            }
            return Math.min(times * 1000, 2000);
          },
          lazyConnect: true
        });

        this.redis.on('connect', () => {
          this.isConnected = true;
          this.lastConnectedAt = new Date().toISOString();
          console.log('✅ [Redis] Conectado com sucesso ao servidor Redis.');
        });

        this.redis.on('error', (err) => {
          this.isConnected = false;
          console.warn('[Redis] Aviso de conexão Redis (usando fallback in-memory):', err.message);
        });

        this.redis.connect().catch((err) => {
          console.warn('[Redis] Usando motor In-Memory Redis ultrarrápido:', err.message);
        });
      } catch (err: any) {
        console.warn('[Redis] Falha ao inicializar ioredis, usando motor In-Memory Redis:', err.message);
      }
    } else {
      console.log('⚡ [Redis] Upstash/REDIS_URL não informados. Motor In-Memory Redis ultrarrápido inicializado com sucesso.');
    }
  }

  private async callUpstashCommand(command: (string | number)[]): Promise<any> {
    if (!this.hasUpstash) return null;
    try {
      const res = await fetch(this.upstashRestUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.upstashRestToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(command)
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.result;
    } catch (err) {
      console.warn('[Upstash REST] Falha na requisição, utilizando fallback em memória:', err);
      return null;
    }
  }

  async get(key: string): Promise<string | null> {
    const start = Date.now();
    this.totalRequests++;

    // 1. Tenta Upstash REST
    if (this.hasUpstash) {
      try {
        const val = await this.callUpstashCommand(['GET', key]);
        const latency = Date.now() - start;
        this.totalLatencyMs += latency;
        if (val !== null && val !== undefined) {
          this.hitCount++;
          // Sincroniza localmente
          this.memoryFallback.set(key, typeof val === 'string' ? val : JSON.stringify(val), 'EX', 60);
          return typeof val === 'string' ? val : JSON.stringify(val);
        }
      } catch {}
    }

    // 2. Tenta ioredis
    try {
      if (this.isConnected && this.redis) {
        const val = await this.redis.get(key);
        const latency = Date.now() - start;
        this.totalLatencyMs += latency;
        if (val !== null) {
          this.hitCount++;
          return val;
        }
      }
    } catch {}

    // 3. Fallback In-Memory ultra-rápido (0ms)
    const val = this.memoryFallback.get(key);
    const latency = Date.now() - start;
    this.totalLatencyMs += latency;
    if (val !== null) {
      this.hitCount++;
    } else {
      this.missCount++;
    }
    return val;
  }

  async set(key: string, value: string, ttlSeconds: number = 180, tags: string[] = []): Promise<string> {
    // 1. Grava no Upstash REST
    if (this.hasUpstash) {
      try {
        await this.callUpstashCommand(['SET', key, value, 'EX', ttlSeconds]);
        if (tags && tags.length > 0) {
          for (const t of tags) {
            await this.callUpstashCommand(['SADD', `porttohub:tag:${t}`, key]);
            await this.callUpstashCommand(['EXPIRE', `porttohub:tag:${t}`, ttlSeconds + 60]);
          }
        }
      } catch {}
    }

    // 2. Grava no ioredis
    try {
      if (this.isConnected && this.redis) {
        await this.redis.set(key, value, 'EX', ttlSeconds);
        if (tags && tags.length > 0) {
          for (const t of tags) {
            await this.redis.sadd(`porttohub:tag:${t}`, key);
            await this.redis.expire(`porttohub:tag:${t}`, ttlSeconds + 60);
          }
        }
      }
    } catch {}

    // 3. Sempre grava no In-Memory para resposta instantânea
    return this.memoryFallback.set(key, value, 'EX', ttlSeconds, tags);
  }

  async del(key: string): Promise<number> {
    if (this.hasUpstash) {
      try {
        await this.callUpstashCommand(['DEL', key]);
      } catch {}
    }
    try {
      if (this.isConnected && this.redis) {
        await this.redis.del(key);
      }
    } catch {}
    return this.memoryFallback.del(key);
  }

  async invalidateByPattern(pattern: string): Promise<number> {
    let count = 0;
    if (this.hasUpstash) {
      try {
        const keys = await this.callUpstashCommand(['KEYS', pattern]);
        if (Array.isArray(keys) && keys.length > 0) {
          await this.callUpstashCommand(['DEL', ...keys]);
          count += keys.length;
        }
      } catch {}
    }
    try {
      if (this.isConnected && this.redis) {
        const keys = await this.redis.keys(pattern);
        if (keys.length > 0) {
          count = await this.redis.del(...keys);
        }
      }
    } catch {}

    const memKeys = this.memoryFallback.keys(pattern);
    for (const k of memKeys) {
      if (this.memoryFallback.del(k)) count++;
    }
    return count;
  }

  async invalidateByTag(tag: string): Promise<number> {
    let count = 0;
    const tagKey = `porttohub:tag:${tag}`;

    if (this.hasUpstash) {
      try {
        const keys = await this.callUpstashCommand(['SMEMBERS', tagKey]);
        if (Array.isArray(keys) && keys.length > 0) {
          await this.callUpstashCommand(['DEL', ...keys]);
          count += keys.length;
        }
        await this.callUpstashCommand(['DEL', tagKey]);
      } catch {}
    }

    try {
      if (this.isConnected && this.redis) {
        const keys = await this.redis.smembers(tagKey);
        if (keys.length > 0) {
          count += await this.redis.del(...keys);
        }
        await this.redis.del(tagKey);
      }
    } catch {}

    count += this.memoryFallback.delByTag(tag);
    return count;
  }

  /**
   * Rate Limiter inteligente na borda / servidor
   * Evita ataques de força bruta, spam de frames de câmera e travamento de dispositivos
   */
  async checkRateLimit(
    identifier: string,
    maxRequests: number = 10,
    windowSeconds: number = 10
  ): Promise<RateLimitResult> {
    const key = `porttohub:ratelimit:${identifier}`;

    // 1. Tenta Upstash REST INCR & EXPIRE
    if (this.hasUpstash) {
      try {
        const currentCount = await this.callUpstashCommand(['INCR', key]);
        if (currentCount === 1) {
          await this.callUpstashCommand(['EXPIRE', key, windowSeconds]);
        }
        const ttl = await this.callUpstashCommand(['TTL', key]);
        const allowed = Number(currentCount) <= maxRequests;
        return {
          allowed,
          remaining: Math.max(0, maxRequests - Number(currentCount)),
          resetSeconds: ttl > 0 ? ttl : windowSeconds,
          total: Number(currentCount)
        };
      } catch {}
    }

    // 2. Fallback In-Memory
    return this.memoryFallback.checkRateLimit(identifier, maxRequests, windowSeconds);
  }

  /**
   * Cache de Autorizados de um condomínio para consulta facial em < 1ms
   */
  async setAutorizadosCache(condominioId: string, lista: AutorizadoCacheItem[], ttlSeconds: number = 3600): Promise<void> {
    const key = `porttohub:autorizados:${condominioId}`;
    await this.set(key, JSON.stringify(lista), ttlSeconds, [`condominio:${condominioId}`, 'autorizados']);
  }

  async getAutorizadosCache(condominioId: string): Promise<AutorizadoCacheItem[] | null> {
    const key = `porttohub:autorizados:${condominioId}`;
    const raw = await this.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async flush(): Promise<string> {
    if (this.hasUpstash) {
      try {
        await this.callUpstashCommand(['FLUSHDB']);
      } catch {}
    }
    try {
      if (this.isConnected && this.redis) {
        await this.redis.flushdb();
      }
    } catch {}
    this.hitCount = 0;
    this.missCount = 0;
    this.totalRequests = 0;
    this.totalLatencyMs = 0;
    return this.memoryFallback.flushdb();
  }

  async getStats(): Promise<CacheStats> {
    let remoteKeys = 0;
    const summary: Record<string, number> = {};

    if (this.hasUpstash) {
      try {
        const keys = await this.callUpstashCommand(['KEYS', 'porttohub:*']);
        if (Array.isArray(keys)) {
          remoteKeys = keys.length;
          for (const k of keys) {
            const parts = String(k).split(':');
            const category = parts[2] || parts[1] || 'outros';
            summary[category] = (summary[category] || 0) + 1;
          }
        }
      } catch {}
    } else if (this.isConnected && this.redis) {
      try {
        const keys = await this.redis.keys('porttohub:*');
        remoteKeys = keys.length;
        for (const k of keys) {
          const parts = k.split(':');
          const category = parts[2] || parts[1] || 'outros';
          summary[category] = (summary[category] || 0) + 1;
        }
      } catch {}
    }

    const memKeys = this.memoryFallback.keys('*');
    for (const k of memKeys) {
      const parts = k.split(':');
      const category = parts[2] || parts[1] || 'outros';
      summary[category] = (summary[category] || 0) + 1;
    }

    const totalKeys = Math.max(remoteKeys, this.memoryFallback.size());
    const totalReq = this.totalRequests || (this.hitCount + this.missCount);
    const hitRatio = totalReq > 0 ? ((this.hitCount / totalReq) * 100).toFixed(1) + '%' : '0.0%';
    const avgLatencyMs = totalReq > 0 ? Number((this.totalLatencyMs / totalReq).toFixed(2)) : 0.8;

    return {
      provider: this.hasUpstash ? 'upstash-redis-rest' : this.isConnected ? 'redis-server' : 'in-memory-redis',
      connected: this.hasUpstash || this.isConnected,
      totalKeys,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRatio,
      totalRequests: totalReq,
      avgLatencyMs,
      lastConnectedAt: this.lastConnectedAt,
      keysSummary: summary,
      upstashConfigured: this.hasUpstash
    };
  }
}

export const redisCache = new RedisCacheManager();
