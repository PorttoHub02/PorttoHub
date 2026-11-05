/**
 * Serviço Especialista em Auditoria e Verificação Biométrica Facial de Alta Precisão
 * Controle de Acesso Físico Condominial (PorttoHub / INFPORT)
 */

export interface ResultadoBiometriaFacial {
  match: boolean;
  confidence_score: number;
  reason: string;
}

export interface RequisicaoBiometriaFacial {
  imagemCadastro: string; // Imagem 1 (Cadastro do Morador/Prestador)
  imagemCaptura: string;  // Imagem 2 (Câmera do Totem/Portaria ao vivo)
}

/**
 * Envia duas imagens para comparação biométrica anatômica de alta precisão
 * no endpoint seguro do servidor com IA Gemini 3.8 Flash
 */
export async function compararBiometriaFacial(
  requisicao: RequisicaoBiometriaFacial
): Promise<ResultadoBiometriaFacial> {
  try {
    const res = await fetch('/api/facial/comparar-biometria', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imagemCadastro: requisicao.imagemCadastro,
        imagemCaptura: requisicao.imagemCaptura
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.erro || `Falha na verificação biométrica (HTTP ${res.status})`);
    }

    const data = await res.json();
    return {
      match: Boolean(data.match),
      confidence_score: Number(data.confidence_score || 0),
      reason: String(data.reason || 'Análise biométrica concluída')
    };
  } catch (err: any) {
    console.warn('[BiometriaService] Aviso na comparação facial:', err.message);
    return {
      match: false,
      confidence_score: 0.0,
      reason: err.message || 'Falha de comunicação com o motor de biometria facial'
    };
  }
}
