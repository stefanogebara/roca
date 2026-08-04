/**
 * "Apaga meus dados" vindo de um prospect.
 *
 * O guard de deleção respondia *"Pronto, apaguei seus dados"* e não apagava
 * nada: `deleteUserData` procura em `users`, devolve `true` quando não acha, e
 * NÃO existia nenhum delete em `prospects` no código inteiro. Dado de terceiro
 * coletado sem consentimento, mais uma declaração falsa ao titular (LGPD
 * Art. 18 §6). São 279 linhas na base, a mais antiga de 09/jul.
 *
 * Duas regras que o conserto precisa respeitar:
 *
 * 1. A SUPRESSÃO SOBREVIVE À EXCLUSÃO. Apagar a linha sem registrar o opt-out
 *    faria o sourcing redescobrir a mesma empresa amanhã e mandar de novo — o
 *    oposto do que a pessoa pediu. `prospect_optouts` é keyed por telefone, sem
 *    FK para `prospects`, e nunca é podada: é a prova legal e o filtro de envio.
 *
 * 2. ACHAR O PROSPECT PELOS DOIS NÚMEROS. Enviamos para `wa_phone` (o citado),
 *    então é de lá que ele responde — mas a busca só olhava `phone`. Medido em
 *    04/ago: 27 prospects foram contatados num wa_phone diferente do phone, e
 *    DOIS deles responderam e viraram "produtor" (AGROTEKNE e AgroRural), com a
 *    Stevi oferecendo diagnóstico de folha para uma revenda que a Vitória
 *    tentava recrutar. Sem este casamento, o pedido de exclusão de 27 empresas
 *    também não seria reconhecido.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../api/_lib/prospect/db', () => ({
  findProspectByPhone: vi.fn(),
  addOptout: vi.fn(),
  deleteProspectByPhone: vi.fn(),
  markProspectReplied: vi.fn(),
  logProspectMessage: vi.fn(),
  getProspectThread: vi.fn(),
  mergeProspectQualification: vi.fn(),
}));

import { deleteProspectData } from '../api/_lib/prospect/inbound';
import { findProspectByPhone, addOptout, deleteProspectByPhone } from '../api/_lib/prospect/db';

const PROSPECT = { id: 'p1', name: 'Agro Teste', phone: '+553538211234', wa_phone: '+5535999887766' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteProspectByPhone).mockResolvedValue(true);
});

describe('deleteProspectData', () => {
  it('apaga o prospect quando ele existe', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue(PROSPECT as never);
    expect(await deleteProspectData('+553538211234')).toBe(true);
    expect(deleteProspectByPhone).toHaveBeenCalledWith('+553538211234');
  });

  it('REGISTRA O OPT-OUT ANTES de apagar — senão o sourcing traz de volta amanhã', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue(PROSPECT as never);
    const ordem: string[] = [];
    vi.mocked(addOptout).mockImplementation(async () => void ordem.push('optout'));
    vi.mocked(deleteProspectByPhone).mockImplementation(async () => {
      ordem.push('delete');
      return true;
    });

    await deleteProspectData('+553538211234');

    expect(ordem).toEqual(['optout', 'delete']);
  });

  it('o opt-out registra que a origem foi pedido de exclusão, não "sair"', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue(PROSPECT as never);
    await deleteProspectData('+553538211234');
    expect(vi.mocked(addOptout).mock.calls[0][1]).toMatch(/exclus|lgpd/i);
  });

  it('acha pelo wa_phone também — é DE LÁ que ele responde', async () => {
    // 27 prospects na base foram contatados num wa_phone != phone. Buscar só
    // por `phone` deixaria o pedido de exclusão deles sem efeito.
    vi.mocked(findProspectByPhone).mockResolvedValue(PROSPECT as never);
    expect(await deleteProspectData('+5535999887766')).toBe(true);
    expect(findProspectByPhone).toHaveBeenCalledWith('+5535999887766');
  });

  it('não é prospect → devolve false, sem gravar opt-out de quem não pediu nada', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue(null);
    expect(await deleteProspectData('+5511999990000')).toBe(false);
    expect(addOptout).not.toHaveBeenCalled();
    expect(deleteProspectByPhone).not.toHaveBeenCalled();
  });

  it('telefone impossível de normalizar não explode', async () => {
    expect(await deleteProspectData('lixo')).toBe(false);
  });

  it('delete que falha devolve false — não confirma o que não fez', async () => {
    vi.mocked(findProspectByPhone).mockResolvedValue(PROSPECT as never);
    vi.mocked(deleteProspectByPhone).mockResolvedValue(false);
    expect(await deleteProspectData('+553538211234')).toBe(false);
    // Mas a supressão fica: ele pediu para sair, e isso vale mesmo se o
    // delete falhar. Melhor suprimido-e-não-apagado que apagado-e-recontatado.
    expect(addOptout).toHaveBeenCalled();
  });
});
