import i18n from './i18n';

type Translation = { en: string; es: string };

// Traduções globais para textos legados ainda escritos diretamente nos componentes.
// As chaves são frases completas para não alterar nomes, dados ou valores cadastrados pela família.
const dictionary: Record<string, Translation> = {
  'Já tenho conta': { en: 'I already have an account', es: 'Ya tengo una cuenta' },
  'Controle Total': { en: 'Complete Control', es: 'Control Total' },
  'Saiba exatamente para onde vai seu dinheiro com gráficos claros e relatórios detalhados.': { en: 'Know exactly where your money goes with clear charts and detailed reports.', es: 'Sepa exactamente adónde va su dinero con gráficos claros e informes detallados.' },
  'Por favor, insira um código.': { en: 'Please enter a code.', es: 'Por favor, introduzca un código.' },
  'Código inválido.': { en: 'Invalid code.', es: 'Código no válido.' },
  'Por favor, digite o nome da família.': { en: 'Please enter the family name.', es: 'Por favor, escriba el nombre de la familia.' },
  'Família não encontrada. Verifique o nome e tente novamente.': { en: 'Family not found. Check the name and try again.', es: 'Familia no encontrada. Compruebe el nombre e inténtelo de nuevo.' },
  'EX: FREE-2026': { en: 'E.g.: FREE-2026', es: 'EJ.: FREE-2026' },
  'Ex: Família Silva': { en: 'E.g.: Smith Family', es: 'Ej.: Familia Silva' },
  'Selecionar idioma': { en: 'Select language', es: 'Seleccionar idioma' },
  'Brasil': { en: 'Brazil', es: 'Brasil' },
  'Estados Unidos': { en: 'United States', es: 'Estados Unidos' },
  'Espanha': { en: 'Spain', es: 'España' },
  'Contas do Mês': { en: 'Monthly Bills', es: 'Facturas del Mes' },
  'Contas & Cofrinhos': { en: 'Accounts & Savings', es: 'Cuentas y Ahorros' },
  'Agenda Família': { en: 'Family Calendar', es: 'Agenda Familiar' },
  'Lista de Compras': { en: 'Shopping List', es: 'Lista de Compras' },
  'Dívidas': { en: 'Debts', es: 'Deudas' },
  'Metas e Sonhos': { en: 'Goals and Dreams', es: 'Metas y Sueños' },
  'Bens e Patrimônio': { en: 'Assets and Property', es: 'Bienes y Patrimonio' },
  'Relatórios': { en: 'Reports', es: 'Informes' },
  'Estoque': { en: 'Inventory', es: 'Inventario' },
  'Planilhas': { en: 'Spreadsheets', es: 'Hojas de Cálculo' },
  'Ranking Familiar': { en: 'Family Ranking', es: 'Ranking Familiar' },
  'Compartilhar / Indicar': { en: 'Share / Refer', es: 'Compartir / Recomendar' },
  'Suporte': { en: 'Support', es: 'Soporte' },
  'Configurações': { en: 'Settings', es: 'Configuración' },
  'Meu Plano': { en: 'My Plan', es: 'Mi Plan' },
  'Sair da família': { en: 'Family Logout', es: 'Salir de la familia' },
  'COMO USAR': { en: 'HOW TO USE', es: 'CÓMO USAR' },
  'Entendi': { en: 'Got it', es: 'Entendido' },
  'Central de ajuda HomeFin': { en: 'HomeFin Help Center', es: 'Centro de ayuda HomeFin' },
  'Passo a passo': { en: 'Step by step', es: 'Paso a paso' },
  'Dicas importantes': { en: 'Important tips', es: 'Consejos importantes' },
  'Fechar guia': { en: 'Close guide', es: 'Cerrar guía' },
  'Sincronização com a nuvem confirmada.': { en: 'Cloud synchronization confirmed.', es: 'Sincronización con la nube confirmada.' },
  'Alterações salvas neste dispositivo; a nuvem ainda não confirmou a sincronização.': { en: 'Changes saved on this device; cloud synchronization is not yet confirmed.', es: 'Cambios guardados en este dispositivo; la nube aún no ha confirmado la sincronización.' },
  'Há uma versão mais recente na nuvem. As alterações deste dispositivo foram preservadas e a sincronização foi bloqueada para evitar sobrescrita; contate o suporte para reconciliar.': { en: 'A newer version is available in the cloud. Changes on this device were preserved and synchronization was blocked to prevent overwriting; contact support to reconcile.', es: 'Hay una versión más reciente en la nube. Se conservaron los cambios de este dispositivo y se bloqueó la sincronización para evitar sobrescrituras; contacte con soporte para conciliar.' },
  'Como usar:': { en: 'How to use:', es: 'Cómo usar:' },
  'Por favor, insira um código.': { en: 'Please enter a code.', es: 'Por favor, introduzca un código.' },
  'Escolha o plano ideal para sua família': { en: 'Choose the ideal plan for your family', es: 'Elija el plan ideal para su familia' },
  'Comece a organizar suas finanças hoje mesmo.': { en: 'Start organizing your finances today.', es: 'Empiece a organizar sus finanzas hoy mismo.' },
  'Mais Popular': { en: 'Most Popular', es: 'Más Popular' },
  'Grátis': { en: 'Free', es: 'Gratis' },
  'Seguro e Privado': { en: 'Secure and Private', es: 'Seguro y Privado' },
  'Seus dados são criptografados e armazenados localmente no seu dispositivo.': { en: 'Your data is encrypted and stored locally on your device.', es: 'Sus datos están cifrados y almacenados localmente en su dispositivo.' },
  'Sem Compromisso': { en: 'No Commitment', es: 'Sin Compromiso' },
  'Cancele a qualquer momento. Sem taxas escondidas.': { en: 'Cancel at any time. No hidden fees.', es: 'Cancele en cualquier momento. Sin cargos ocultos.' },
  'Configuração Rápida': { en: 'Quick Setup', es: 'Configuración Rápida' },
  'Comece a usar em menos de 2 minutos.': { en: 'Start using it in less than 2 minutes.', es: 'Empiece a usarlo en menos de 2 minutos.' },
  'Checkout Seguro': { en: 'Secure Checkout', es: 'Pago Seguro' },
  'Cupom de Desconto': { en: 'Discount Coupon', es: 'Cupón de Descuento' },
  'Aplicar': { en: 'Apply', es: 'Aplicar' },
  'Total a pagar': { en: 'Total to pay', es: 'Total a pagar' },
  'Plano': { en: 'Plan', es: 'Plan' },
  'Forma de Pagamento': { en: 'Payment Method', es: 'Método de Pago' },
  'Cartão': { en: 'Card', es: 'Tarjeta' },
  'Gere um QR Code único para pagamento instantâneo.': { en: 'Generate a unique QR code for instant payment.', es: 'Genere un código QR único para el pago instantáneo.' },
  'Gerar PIX': { en: 'Generate PIX', es: 'Generar PIX' },
  'Escaneie o QR Code acima': { en: 'Scan the QR code above', es: 'Escanee el código QR de arriba' },
  'Copiar Código PIX': { en: 'Copy PIX Code', es: 'Copiar Código PIX' },
  'Pagamento 100% Seguro': { en: '100% Secure Payment', es: 'Pago 100% Seguro' },
  'Processando...': { en: 'Processing...', es: 'Procesando...' },
  'Confirmar Pagamento': { en: 'Confirm Payment', es: 'Confirmar Pago' },
  'Confirmar (Grátis)': { en: 'Confirm (Free)', es: 'Confirmar (Gratis)' },
  'Voltar para Início': { en: 'Back to Home', es: 'Volver al Inicio' },
  'Instalar aplicativo': { en: 'Install app', es: 'Instalar aplicación' },
  'Ver instruções de instalação': { en: 'View installation instructions', es: 'Ver instrucciones de instalación' },
  'Configuração Inicial': { en: 'Initial Setup', es: 'Configuración Inicial' },
  'Cadastro concluído': { en: 'Registration completed', es: 'Registro completado' },
  'Finalizar': { en: 'Finish', es: 'Finalizar' },
  'Salvar': { en: 'Save', es: 'Guardar' },
  'Cancelar': { en: 'Cancel', es: 'Cancelar' },
  'Editar': { en: 'Edit', es: 'Editar' },
  'Excluir': { en: 'Delete', es: 'Eliminar' },
  'Adicionar': { en: 'Add', es: 'Añadir' },
  'Novo': { en: 'New', es: 'Nuevo' },
  'Buscar': { en: 'Search', es: 'Buscar' },
  'Pesquisar': { en: 'Search', es: 'Buscar' },
  'Filtrar': { en: 'Filter', es: 'Filtrar' },
  'Todos': { en: 'All', es: 'Todos' },
  'Nenhum registro encontrado.': { en: 'No records found.', es: 'No se encontraron registros.' },
  'Carregando...': { en: 'Loading...', es: 'Cargando...' },
  'Aguarde...': { en: 'Please wait...', es: 'Espere...' },
  'Confirmar': { en: 'Confirm', es: 'Confirmar' },
  'Fechar': { en: 'Close', es: 'Cerrar' },
  'Voltar': { en: 'Back', es: 'Volver' },
  'Continuar': { en: 'Continue', es: 'Continuar' },
  'Próximo': { en: 'Next', es: 'Siguiente' },
  'Anterior': { en: 'Previous', es: 'Anterior' },
  'Sim': { en: 'Yes', es: 'Sí' },
  'Não': { en: 'No', es: 'No' },
  'Nome': { en: 'Name', es: 'Nombre' },
  'Descrição': { en: 'Description', es: 'Descripción' },
  'Valor': { en: 'Amount', es: 'Valor' },
  'Data': { en: 'Date', es: 'Fecha' },
  'Categoria': { en: 'Category', es: 'Categoría' },
  'Quantidade': { en: 'Quantity', es: 'Cantidad' },
  'Preço': { en: 'Price', es: 'Precio' },
  'Observações': { en: 'Notes', es: 'Observaciones' },
  'Status': { en: 'Status', es: 'Estado' },
  'Pendente': { en: 'Pending', es: 'Pendiente' },
  'Pago': { en: 'Paid', es: 'Pagado' },
  'Concluído': { en: 'Completed', es: 'Completado' },
  'Data de vencimento': { en: 'Due date', es: 'Fecha de vencimiento' },
  'Nova Conta': { en: 'New Bill', es: 'Nueva Factura' },
  'Adicionar Produto': { en: 'Add Product', es: 'Añadir Producto' },
  'Nova Planilha': { en: 'New Spreadsheet', es: 'Nueva Hoja de Cálculo' },
  'Histórico': { en: 'History', es: 'Historial' },
  'Entrar': { en: 'Sign in', es: 'Entrar' },
  'Acessar': { en: 'Access', es: 'Acceder' },
  'Já tenho conta': { en: 'I already have an account', es: 'Ya tengo una cuenta' },
  'Por favor, digite o nome da família.': { en: 'Please enter the family name.', es: 'Por favor, escriba el nombre de la familia.' },
};

const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

function translateTextNode(node: Text, language: string) {
  const parent = node.parentElement;
  if (!parent || ignoredTags.has(parent.tagName) || parent.closest('[data-no-auto-translate="true"]')) return;
  if (!originalText.has(node)) originalText.set(node, node.nodeValue || '');
  const original = originalText.get(node) || '';
  const trimmed = original.trim();
  if (!trimmed) return;
  const translated = language === 'pt' ? original : dictionary[trimmed]?.[language as 'en' | 'es'];
  if (translated === undefined) return;
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  const next = language === 'pt' ? original : leading + translated + trailing;
  if (node.nodeValue !== next) node.nodeValue = next;
}

function translateAttributes(element: Element, language: string) {
  for (const attribute of ['placeholder', 'title', 'aria-label']) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    let saved = originalAttributes.get(element);
    if (!saved) {
      saved = new Map<string, string>();
      originalAttributes.set(element, saved);
    }
    if (!saved.has(attribute)) saved.set(attribute, current);
    const original = saved.get(attribute) || current;
    const translated = language === 'pt' ? original : dictionary[original]?.[language as 'en' | 'es'];
    if (translated !== undefined && current !== translated) element.setAttribute(attribute, translated);
  }
}

function translateTree(root: Node, language: string) {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text, language);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  const element = root as Element;
  if (element instanceof Element) translateAttributes(element, language);
  root.childNodes.forEach(child => translateTree(child, language));
}

let observer: MutationObserver | null = null;

export function startGlobalDomTranslation() {
  if (typeof document === 'undefined' || observer) return;
  const apply = (language: string) => translateTree(document.body, language.split('-')[0]);
  apply(i18n.resolvedLanguage || i18n.language || 'pt');
  observer = new MutationObserver(records => {
    const language = (i18n.resolvedLanguage || i18n.language || 'pt').split('-')[0];
    for (const record of records) {
      if (record.type === 'characterData') translateTextNode(record.target as Text, language);
      else record.addedNodes.forEach(node => translateTree(node, language));
      if (record.type === 'attributes' && record.target instanceof Element) translateAttributes(record.target, language);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
  i18n.on('languageChanged', apply);
}
