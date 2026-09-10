import { FormatMask } from './FormatMask';

/**
 * Substitui @{numero} no texto por um nome legível.
 * Usado para exibir menções de contatos em mensagens de grupo.
 *
 * - contactsMap: objeto { [number]: name } para resolver nomes conhecidos
 * - Números com > 13 dígitos (LID do WhatsApp) são exibidos como "@Contato"
 * - Números com ≤ 13 dígitos são formatados com máscara de telefone
 *
 * Só considera menção real quando o "@" começa uma palavra (início do texto
 * ou precedido de espaço/quebra de linha) e o número tem >= 10 dígitos —
 * mesmo mínimo exigido por FormatMask para um telefone válido. Isso evita
 * que textos comuns como "Senha: Leandro@1406" ou e-mails/senhas com "@"
 * colado a dígitos curtos sejam confundidos com menção e substituídos por
 * "Número não disponível".
 */
const formatMentions = (text, contactsMap = {}) => {
  if (!text || typeof text !== 'string') return text;

  return text.replace(/(^|\s)@(\d{10,})/g, (match, prefix, digits) => {
    if (contactsMap[digits]) {
      return `${prefix}@${contactsMap[digits]}`;
    }

    if (digits.length > 13) {
      return `${prefix}@Contato`;
    }

    try {
      const mask = new FormatMask();
      return `${prefix}@${mask.setPhoneFormatMask(digits)}`;
    } catch {
      return match;
    }
  });
};

export default formatMentions;
