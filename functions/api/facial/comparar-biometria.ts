/**
 * Cloudflare Pages Function: /api/facial/comparar-biometria
 * Auditoria e Verificação Biométrica Facial com Gemini 3.8 Flash
 */

const INSTRUCAO_SISTEMA_BIOMETRIA_FACIAL = `Você é um sistema especialista em auditoria e verificação biométrica facial de alta precisão para controle de acesso físico em condomínios. Sua única função é comparar duas imagens e determinar se a pessoa capturada na Imagem 2 é a mesma pessoa cadastrada na Imagem 1.

DIRETRIZES DE PROCESSAMENTO E LEITURA:
1. DESCONSIDERAÇÃO TOTAL DE ELEMENTOS DE FUNDO:
   - Ignore completamente paredes, portas, pisos, iluminação ambiente, reflexos, sombras e qualquer objeto ao fundo.
   - O fato de haver uma parede ou textura atrás do indivíduo NUNCA deve ser interpretado como um rosto ou estrutura humana.
   - Localize e isola exclusivamente a região facial da Imagem 2. Se nenhum rosto humano claro for detectado na Imagem 2, descarte imediatamente a análise e defina "match": false.

2. CRITÉRIOS DE COMPARAÇÃO FACIAL (ANÁLISE ANATÔMICA):
   - Analise e compare estritamente a geometria e estrutura óssea facial entre a Imagem 1 (cadastro) e a Imagem 2 (câmera):
     * Distância interpapilar (espaço entre os olhos) e formato dos olhos.
     * Proporção, ponte e base do nariz.
     * Projeção das maçãs do rosto (zigomático) e linha da mandíbula.
     * Distância entre a base do nariz e o lábio superior, e do lábio inferior ao queixo.
   - Desconsidere variações temporárias como corte de cabelo, expressão facial, uso de maquiagem, óculos de grau ou iluminação diferente.

3. REGRA DE SEGURANÇA E ZERO TOLERÂNCIA A FALSOS POSITIVOS:
   - Apenas confirme uma correspondência positiva ("match": true) se houver certeza absoluta de que se trata da mesma pessoa.
   - Em caso de dúvida, ângulo muito inclinado, rosto parcialmente oculto, baixa resolução ou divergência na estrutura óssea, defina "match": false.
   - NUNCA assuma a identidade de uma pessoa caso a foto seja incerta.

4. FORMATO ESTRITO DE RESPOSTA (OBRIGATÓRIO):
   - Sua saída deve ser EXCLUSIVAMENTE um objeto JSON válido, sem nenhum texto introdutório, explicações antes ou depois, e sem blocos de código markdown.
   - O JSON deve conter exatamente as seguintes chaves:
     {
       "match": boolean,
       "confidence_score": number,
       "reason": "string"
     }`;

export async function onRequestPost(context: any) {
  try {
    const { request, env } = context;
    const body = await request.json();
    const { imagemCadastro, imagemCaptura, imagemCadastroBase64, imagemCapturaBase64 } = body || {};
    const imgCad = imagemCadastro || imagemCadastroBase64;
    const imgCap = imagemCaptura || imagemCapturaBase64;

    if (!imgCad || !imgCap) {
      return new Response(JSON.stringify({
        match: false,
        confidence_score: 0.0,
        reason: 'Ambas as imagens são obrigatórias para comparação facial.'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const apiKey = env?.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({
        match: false,
        confidence_score: 0.0,
        reason: 'GEMINI_API_KEY não configurada na borda Cloudflare.'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const extractData = (str: string) => {
      const m = str.match(/^data:([^;]+);base64,(.+)$/);
      return m ? { mime: m[1], data: m[2] } : { mime: 'image/jpeg', data: str.replace(/^data:[^;]+;base64,/, '') };
    };

    const p1 = extractData(imgCad);
    const p2 = extractData(imgCap);

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'aistudio-build' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCAO_SISTEMA_BIOMETRIA_FACIAL }] },
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'OBJECT',
            properties: {
              match: { type: 'BOOLEAN' },
              confidence_score: { type: 'NUMBER' },
              reason: { type: 'STRING' }
            },
            required: ['match', 'confidence_score', 'reason']
          }
        },
        contents: [{
          parts: [
            { inlineData: { mimeType: p1.mime, data: p1.data } },
            { text: 'Imagem 1: Foto cadastrada oficialmente no condomínio.' },
            { inlineData: { mimeType: p2.mime, data: p2.data } },
            { text: 'Imagem 2: Foto capturada pela câmera/totem em tempo real.' }
          ]
        }]
      })
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API HTTP ${geminiRes.status}: ${errText}`);
    }

    const gData: any = await geminiRes.json();
    const rawJsonText = gData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsed = JSON.parse(rawJsonText);

    return new Response(JSON.stringify({
      match: Boolean(parsed.match),
      confidence_score: typeof parsed.confidence_score === 'number' ? parsed.confidence_score : (parsed.match ? 0.95 : 0.05),
      reason: parsed.reason || (parsed.match ? 'Estrutura facial equivalente' : 'Divergência anatômica detectada')
    }), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({
      match: false,
      confidence_score: 0.0,
      reason: err.message || 'Erro no processamento da biometria na borda'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
