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
  "Total": { en: "Total", es: "Total" },
  "Saldo Atual": { en: "Current Balance", es: "Saldo Actual" },
  "Saldo Previsto": { en: "Projected Balance", es: "Saldo Previsto" },
  "Duplicar": { en: "Duplicate", es: "Duplicar" },
  "Carregando contas...": { en: "Loading bills...", es: "Cargando facturas..." },
  "Nenhum lançamento neste mês.": { en: "No entries this month.", es: "No hay movimientos este mes." },
  "Meses em atraso": { en: "Overdue months", es: "Meses de retraso" },
  "Valor em aberto": { en: "Outstanding amount", es: "Importe pendiente" },
  "Mês / Ano": { en: "Month / Year", es: "Mes / Año" },
  "Vencimento": { en: "Due date", es: "Vencimiento" },
  "Em aberto": { en: "Outstanding", es: "Pendiente" },
  "Nenhum mês em atraso": { en: "No overdue months", es: "No hay meses atrasados" },
  "Não há vencimentos pendentes anteriores a hoje para esta conta.": { en: "There are no pending due dates before today for this account.", es: "No hay vencimientos pendientes anteriores a hoy para esta cuenta." },
  "Valor Total (R$)": { en: "Total Amount (BRL)", es: "Importe Total (BRL)" },
  "Valor Pago (R$)": { en: "Amount Paid (BRL)", es: "Importe Pagado (BRL)" },
  "Descrição Principal": { en: "Main Description", es: "Descripción Principal" },
  "Repetir mensalmente": { en: "Repeat monthly", es: "Repetir mensualmente" },
  "Gera os próximos meses automaticamente. Contas antigas não são alteradas.": { en: "Automatically creates entries for upcoming months. Previous bills are not changed.", es: "Crea automáticamente los próximos meses. Las facturas anteriores no se modifican." },
  "Subconta / Observação": { en: "Sub-account / Note", es: "Subcuenta / Observación" },
  "Atribuído a (Membro)": { en: "Assigned to (Member)", es: "Asignado a (Miembro)" },
  "Nenhum": { en: "None", es: "Ninguno" },
  "Adicionado por": { en: "Added by", es: "Añadido por" },
  "Pago por": { en: "Paid by", es: "Pagado por" },
  "Destacar em Negrito (Prioridade)": { en: "Highlight in Bold (Priority)", es: "Resaltar en Negrita (Prioridad)" },
  "Anexos": { en: "Attachments", es: "Adjuntos" },
  "Excluir Conta?": { en: "Delete bill?", es: "¿Eliminar factura?" },
  "Copiar Contas?": { en: "Copy bills?", es: "¿Copiar facturas?" },
  "Deseja copiar todas as contas deste mês para o próximo mês?": { en: "Do you want to copy all bills from this month to next month?", es: "¿Desea copiar todas las facturas de este mes al próximo?" },
  "Adicionar Contas:": { en: "Add Bills:", es: "Añadir Facturas:" },
  "Marcar como Pago:": { en: "Mark as Paid:", es: "Marcar como Pagado:" },
  "Opções Extras:": { en: "Extra Options:", es: "Opciones Extra:" },
  "Leitura Inteligente (IA):": { en: "Smart Scan (AI):", es: "Lectura Inteligente (IA):" },
  "No Carrinho": { en: "In Cart", es: "En el Carrito" },
  "Salvar Alteração": { en: "Save Changes", es: "Guardar Cambios" },
  "Hora de Repor?": { en: "Time to Restock?", es: "¿Hora de Reponer?" },
  "Esqueceu disso?": { en: "Forgot about this?", es: "¿Se olvidó de esto?" },
  "Sem valor": { en: "No amount", es: "Sin valor" },
  "Tudo em ordem por aqui!": { en: "Everything is in order!", es: "¡Todo en orden por aquí!" },
  "Toque nas sugestões acima quando algo acabar.": { en: "Tap the suggestions above when something runs out.", es: "Toque las sugerencias de arriba cuando algo se termine." },
  "Finalizar Compra": { en: "Complete Purchase", es: "Finalizar Compra" },
  "Gerar Despesa": { en: "Create Expense", es: "Generar Gasto" },
  "Adicionar Itens:": { en: "Add Items:", es: "Añadir Artículos:" },
  "Sugestões Inteligentes:": { en: "Smart Suggestions:", es: "Sugerencias Inteligentes:" },
  "Despesa Paga": { en: "Expense Paid", es: "Gasto Pagado" },
  "Lembretes de Compra:": { en: "Shopping Reminders:", es: "Recordatorios de Compra:" },
  "Cálculo automático": { en: "Automatic Calculation", es: "Cálculo automático" },
  "Por linha — calcular cada registro": { en: "By row — calculate each record", es: "Por fila — calcular cada registro" },
  "Por coluna — calcular os totais acumulados": { en: "By column — calculate cumulative totals", es: "Por columna — calcular los totales acumulados" },
  "Selecione uma coluna": { en: "Select a column", es: "Seleccione una columna" },
  "+ Somar": { en: "+ Add", es: "+ Sumar" },
  "− Subtrair": { en: "− Subtract", es: "− Restar" },
  "× Multiplicar": { en: "× Multiply", es: "× Multiplicar" },
  "÷ Dividir": { en: "÷ Divide", es: "÷ Dividir" },
  "Se o divisor for zero, o resultado será exibido como traço (—).": { en: "If the divisor is zero, the result will be shown as a dash (—).", es: "Si el divisor es cero, el resultado se mostrará como un guion (—)." },
  "Exportar PDF": { en: "Export PDF", es: "Exportar PDF" },
  "Escolha as colunas que deseja incluir. A planilha original não será alterada.": { en: "Choose the columns you want to include. The original spreadsheet will not be changed.", es: "Elija las columnas que desea incluir. La hoja original no se modificará." },
  "Selecionar todas": { en: "Select all", es: "Seleccionar todo" },
  "Desmarcar todas": { en: "Deselect all", es: "Desmarcar todo" },
  "Gerar PDF": { en: "Generate PDF", es: "Generar PDF" },
  "Nova coluna": { en: "New column", es: "Nueva columna" },
  "Texto / descrição": { en: "Text / description", es: "Texto / descripción" },
  "Valor em R$ (entra no total)": { en: "Amount in BRL (included in total)", es: "Valor en BRL (incluido en el total)" },
  "Guia rápido": { en: "Quick Guide", es: "Guía rápida" },
  "Como usar as Planilhas": { en: "How to use Spreadsheets", es: "Cómo usar las Hojas de Cálculo" },
  "Um passo a passo simples para organizar e acompanhar seus valores.": { en: "A simple step-by-step guide to organize and track your amounts.", es: "Una guía sencilla paso a paso para organizar y seguir sus valores." },
  "Organização e serviços": { en: "Organization and services", es: "Organización y servicios" },
  "Histórico de planilhas": { en: "Spreadsheet History", es: "Historial de hojas de cálculo" },
  "Pesquise por nome, mês ou ano.": { en: "Search by name, month, or year.", es: "Busque por nombre, mes o año." },
  "Configurar comissões": { en: "Set up commissions", es: "Configurar comisiones" },
  "Total geral": { en: "Grand total", es: "Total general" },
  "Salvando...": { en: "Saving...", es: "Guardando..." },
  "Alterações não salvas": { en: "Unsaved changes", es: "Cambios sin guardar" },
  "Salvo na nuvem": { en: "Saved to cloud", es: "Guardado en la nube" },
  "Salvo somente neste dispositivo": { en: "Saved on this device only", es: "Guardado solo en este dispositivo" },
  "Configurações de comissão": { en: "Commission Settings", es: "Configuración de comisiones" },
  "Configure os cálculos sem ocupar espaço na planilha.": { en: "Configure calculations without taking up space in the spreadsheet.", es: "Configure los cálculos sin ocupar espacio en la hoja." },
  "Calcular comissão percentual": { en: "Calculate percentage commission", es: "Calcular comisión porcentual" },
  "O resultado aparece abaixo do total geral e não altera esse total.": { en: "The result appears below the grand total and does not change that total.", es: "El resultado aparece debajo del total general y no modifica ese total." },
  "Valor total geral": { en: "Overall total amount", es: "Importe total general" },
  "Calcular comissão extra sobre venda acima do preço": { en: "Calculate extra commission on sales above the price", es: "Calcular comisión extra sobre ventas por encima del precio" },
  "Percentual sobre o excedente": { en: "Percentage on the excess", es: "Porcentaje sobre el excedente" },
  "Valor fixo por unidade acima do preço": { en: "Fixed amount per unit above the price", es: "Importe fijo por unidad por encima del precio" },
  "Lançamentos": { en: "Entries", es: "Movimientos" },
  "Preenchimento rápido": { en: "Quick Entry", es: "Entrada rápida" },
  "Total por coluna": { en: "Total by column", es: "Total por columna" },
  "Novo evento": { en: "New Event", es: "Nuevo Evento" },
  "Nenhum evento neste mês.": { en: "No events this month.", es: "No hay eventos este mes." },
  "Não repetir": { en: "Do not repeat", es: "No repetir" },
  "Diariamente": { en: "Daily", es: "Diariamente" },
  "Semanalmente": { en: "Weekly", es: "Semanalmente" },
  "Mensalmente": { en: "Monthly", es: "Mensualmente" },
  "Anualmente": { en: "Yearly", es: "Anualmente" },
  "Repetir até:": { en: "Repeat until:", es: "Repetir hasta:" },
  "Aplicar alterações a toda a série": { en: "Apply changes to the entire series", es: "Aplicar cambios a toda la serie" },
  "Gerencie seus saldos e metas": { en: "Manage your balances and goals", es: "Gestione sus saldos y objetivos" },
  "Saldo Total nas Contas": { en: "Total Account Balance", es: "Saldo Total en Cuentas" },
  "Total Guardado (Cofrinhos)": { en: "Total Saved (Savings Goals)", es: "Total Ahorrado (Metas de Ahorro)" },
  "Nenhuma conta cadastrada.": { en: "No accounts registered.", es: "No hay cuentas registradas." },
  "Nenhum cofrinho criado.": { en: "No savings goals created.", es: "No se han creado alcancías." },
  "Nome da Conta": { en: "Account Name", es: "Nombre de la Cuenta" },
  "Conta Corrente": { en: "Checking Account", es: "Cuenta Corriente" },
  "Poupança": { en: "Savings Account", es: "Cuenta de Ahorros" },
  "Carteira (Dinheiro Físico)": { en: "Wallet (Cash)", es: "Cartera (Efectivo)" },
  "Nome do Cofrinho": { en: "Savings Goal Name", es: "Nombre de la Alcancía" },
  "Meta (R$)": { en: "Goal (BRL)", es: "Meta (BRL)" },
  "Guardado (R$)": { en: "Saved (BRL)", es: "Ahorrado (BRL)" },
  "Contas Bancárias:": { en: "Bank Accounts:", es: "Cuentas Bancarias:" },
  "Cofrinhos (Metas):": { en: "Savings Goals:", es: "Alcancías (Metas):" },
  "Gerencie suas conquistas": { en: "Manage your assets", es: "Gestione sus bienes" },
  "Patrimônio Total": { en: "Total Assets", es: "Patrimonio Total" },
  "Novo Bem": { en: "New Asset", es: "Nuevo Bien" },
  "Nome do Bem": { en: "Asset Name", es: "Nombre del Bien" },
  "Valor Pago": { en: "Amount Paid", es: "Importe Pagado" },
  "Data de Aquisição": { en: "Acquisition Date", es: "Fecha de Adquisición" },
  "Foto do Bem": { en: "Asset Photo", es: "Foto del Bien" },
  "Subir do Aparelho": { en: "Upload from Device", es: "Subir desde el Dispositivo" },
  "Registrar um Bem:": { en: "Register an Asset:", es: "Registrar un Bien:" },
  "Patrimônio Total:": { en: "Total Assets:", es: "Patrimonio Total:" },
  "Gerenciar Bens:": { en: "Manage Assets:", es: "Gestionar Bienes:" },
  "Baixar PDF": { en: "Download PDF", es: "Descargar PDF" },
  "Fluxo de Despesas (Pago vs Pendente)": { en: "Expense Flow (Paid vs Pending)", es: "Flujo de Gastos (Pagado vs Pendiente)" },
  "Carregando dados...": { en: "Loading data...", es: "Cargando datos..." },
  "Sem dados suficientes": { en: "Not enough data", es: "Datos insuficientes" },
  "Detalhamento de Lançamentos": { en: "Entry Details", es: "Detalle de Movimientos" },
  "Destino": { en: "Destination", es: "Destino" },
  "Controle de Dívidas": { en: "Debt Management", es: "Control de Deudas" },
  "Nova Dívida:": { en: "New Debt:", es: "Nueva Deuda:" },
  "Atualizar Pagamentos:": { en: "Update Payments:", es: "Actualizar Pagos:" },
  "Dívidas Quitadas:": { en: "Paid Off Debts:", es: "Deudas Saldadas:" },
  "Valor Total": { en: "Total Amount", es: "Importe Total" },
  "Total Pago": { en: "Total Paid", es: "Total Pagado" },
  "Restante": { en: "Remaining", es: "Restante" },
  "Pessoa": { en: "Person", es: "Persona" },
  "Ações": { en: "Actions", es: "Acciones" },
  "Quitado": { en: "Paid Off", es: "Saldado" },
  "Observações (Opcional)": { en: "Notes (Optional)", es: "Observaciones (Opcional)" },
  "Excluir Dívida?": { en: "Delete Debt?", es: "¿Eliminar Deuda?" },
  "Esta ação não pode ser desfeita.": { en: "This action cannot be undone.", es: "Esta acción no se puede deshacer." },
  "Calculando ranking...": { en: "Calculating ranking...", es: "Calculando ranking..." },
  "Como é calculado?": { en: "How is it calculated?", es: "¿Cómo se calcula?" },
  "O Pódio:": { en: "The Podium:", es: "El Podio:" },
  "Navegação por Meses:": { en: "Month Navigation:", es: "Navegación por Meses:" },
  "HomeFin — Organização financeira familiar": { en: "HomeFin — Family financial organization", es: "HomeFin — Organización financiera familiar" },
  "Suporte HomeFin": { en: "HomeFin Support", es: "Soporte HomeFin" },
  "Dashboard": { en: "Dashboard", es: "Panel" },
  "Nova Meta": { en: "New Goal", es: "Nueva Meta" },
  "Ajustar enquadramento da foto": { en: "Adjust photo framing", es: "Ajustar encuadre de la foto" },
  "Criar uma Meta:": { en: "Create a Goal:", es: "Crear una Meta:" },
  "Acompanhar o Progresso:": { en: "Track Progress:", es: "Seguir el Progreso:" },
  "Atualizar Valores:": { en: "Update Amounts:", es: "Actualizar Valores:" },
  "Nome da Família": { en: "Family Name", es: "Nombre de la Familia" },
  "Nome da Família / Casa": { en: "Family / Home Name", es: "Nombre de la Familia / Hogar" },
  "Código de Acesso": { en: "Access Code", es: "Código de Acceso" },
  "Não tenho código (Ver Planos)": { en: "I don't have a code (View Plans)", es: "No tengo código (Ver Planes)" },
  "Sim, tenho um código": { en: "Yes, I have a code", es: "Sí, tengo un código" },
  "Acessar Família": { en: "Access Family", es: "Acceder a la Familia" },
  "Bem-vindo!": { en: "Welcome!", es: "¡Bienvenido!" },
  "Para começar, você possui um código de convite?": { en: "To get started, do you have an invitation code?", es: "Para comenzar, ¿tiene un código de invitación?" },
  "Digite o nome da sua família para entrar.": { en: "Enter your family name to sign in.", es: "Escriba el nombre de su familia para entrar." },
  "Suas Finanças,": { en: "Your Finances,", es: "Tus Finanzas," },
  "Simplificadas.": { en: "Simplified.", es: "Simplificadas." },
  "Gerencie contas, metas e sonhos da sua família em um só lugar. Simples, seguro e feito para você.": { en: "Manage your family's bills, goals, and dreams in one place. Simple, secure, and made for you.", es: "Gestione las cuentas, metas y sueños de su familia en un solo lugar. Sencillo, seguro y hecho para usted." },
  "Criar Conta Grátis": { en: "Create Free Account", es: "Crear Cuenta Gratis" },
  "Básico": { en: "Basic", es: "Básico" },
  "Família Pro": { en: "Family Pro", es: "Familia Pro" },
  "/mês": { en: "/month", es: "/mes" },
  "Gestão de Contas": { en: "Bill Management", es: "Gestión de Cuentas" },
  "1 Usuário": { en: "1 User", es: "1 Usuario" },
  "Relatórios Simples": { en: "Basic Reports", es: "Informes Básicos" },
  "Começar Grátis": { en: "Start for Free", es: "Empezar Gratis" },
  "Tudo do Básico": { en: "Everything in Basic", es: "Todo lo del Básico" },
  "Patrimônio": { en: "Assets", es: "Patrimonio" },
  "Multi-usuários": { en: "Multiple Users", es: "Multiusuarios" },
  "Relatórios Avançados": { en: "Advanced Reports", es: "Informes Avanzados" },
  "Suporte Prioritário": { en: "Priority Support", es: "Soporte Prioritario" },
  "Assinar Agora": { en: "Subscribe Now", es: "Suscribirse Ahora" },
  "Tema do Aplicativo": { en: "App Theme", es: "Tema de la Aplicación" },
  "Contas do mês": { en: "Monthly Bills", es: "Facturas del mes" },
  "Compras": { en: "Shopping", es: "Compras" },
  "Calendário": { en: "Calendar", es: "Calendario" },
  "Carteiras": { en: "Wallets", es: "Carteras" },
  "Metas": { en: "Goals", es: "Metas" },
  "Cor Principal": { en: "Primary Color", es: "Color Principal" },
  "Imagem de Fundo (Login)": { en: "Login Background Image", es: "Imagen de Fondo (Inicio de Sesión)" },
  "Upload de Fundo": { en: "Upload Background", es: "Subir Fondo" },
  "Ajustar": { en: "Adjust", es: "Ajustar" },
  "Logotipo Personalizado": { en: "Custom Logo", es: "Logotipo Personalizado" },
  "Upload de Logo": { en: "Upload Logo", es: "Subir Logotipo" },
  "Ativar menu flutuante": { en: "Enable floating menu", es: "Activar menú flotante" },
  "O botão aparece nas telas do sistema quando não há menus ou janelas abertas.": { en: "The button appears on app screens when no menus or windows are open.", es: "El botón aparece en las pantallas de la aplicación cuando no hay menús ni ventanas abiertas." },
  "Páginas e ações disponíveis": { en: "Available pages and actions", es: "Páginas y acciones disponibles" },
  "Ícone e texto": { en: "Icon and text", es: "Icono y texto" },
  "Somente texto": { en: "Text only", es: "Solo texto" },
  "Somente ícone": { en: "Icon only", es: "Solo icono" },
  "Nenhuma categoria definida.": { en: "No category defined.", es: "No hay ninguna categoría definida." },
  "Adicione pessoas para atribuir gastos a elas (ex: Pedro, Maria, Filho).": { en: "Add people to assign expenses to them (e.g. Alex, Maria, Child).", es: "Añada personas para asignarles gastos (p. ej., Pedro, María, Hijo)." },
  "Nenhum membro definido.": { en: "No members defined.", es: "No hay miembros definidos." },
  "Geral": { en: "General", es: "General" },
  "Nome da Casa": { en: "Household Name", es: "Nombre del Hogar" },
  "Receba alertas sobre novas contas, metas e atividades.": { en: "Receive alerts about new bills, goals, and activities.", es: "Reciba alertas sobre nuevas facturas, metas y actividades." },
  "Alertas do Sistema": { en: "System Alerts", es: "Alertas del Sistema" },
  "Lembrete Automático de Contas": { en: "Automatic Bill Reminder", es: "Recordatorio Automático de Facturas" },
  "Seja avisado quando uma conta estiver perto do vencimento.": { en: "Get notified when a bill is close to its due date.", es: "Reciba un aviso cuando una factura esté cerca de su vencimiento." },
  "Push (Navegador)": { en: "Push (Browser)", es: "Push (Navegador)" },
  "WhatsApp": { en: "WhatsApp", es: "WhatsApp" },
  "E-mail": { en: "Email", es: "Correo electrónico" },
  "Alterar Senha de Acesso": { en: "Change Access Password", es: "Cambiar Contraseña de Acceso" },
  "Mudar seu PIN de 4 dígitos": { en: "Change your 4-digit PIN", es: "Cambie su PIN de 4 dígitos" },
  "Palavra-chave de Recuperação": { en: "Recovery Keyword", es: "Palabra Clave de Recuperación" },
  "Para recuperar a conta se esquecer o PIN": { en: "Recover your account if you forget your PIN", es: "Para recuperar la cuenta si olvida el PIN" },
  "Posição": { en: "Position", es: "Posición" },
  "Horizontal (X)": { en: "Horizontal (X)", es: "Horizontal (X)" },
  "Vertical (Y)": { en: "Vertical (Y)", es: "Vertical (Y)" },
  "Ajustes do Fundo": { en: "Background Settings", es: "Ajustes del Fondo" },
  "Zoom da Imagem": { en: "Image Zoom", es: "Zoom de Imagen" },
  "Opacidade da Imagem": { en: "Image Opacity", es: "Opacidad de Imagen" },
  "Ajustes do Card": { en: "Card Settings", es: "Ajustes de Tarjeta" },
  "Cobrir Tela Inteira": { en: "Cover Entire Screen", es: "Cubrir Toda la Pantalla" },
  "Opacidade do Card": { en: "Card Opacity", es: "Opacidad de Tarjeta" },
  "Estilo do Logo": { en: "Logo Style", es: "Estilo del Logotipo" },
  "Tamanho do Contêiner": { en: "Container Size", es: "Tamaño del Contenedor" },
  "Zoom Interno (Imagem)": { en: "Internal Zoom (Image)", es: "Zoom Interno (Imagen)" },
  "Alterar Senha (PIN)": { en: "Change Password (PIN)", es: "Cambiar Contraseña (PIN)" },
  "PIN Atual": { en: "Current PIN", es: "PIN Actual" },
  "Novo PIN": { en: "New PIN", es: "Nuevo PIN" },
  "Palavra-chave": { en: "Keyword", es: "Palabra Clave" },
  "PIN Atual (Confirmação)": { en: "Current PIN (Confirmation)", es: "PIN Actual (Confirmación)" },
  "Excluir família?": { en: "Delete family?", es: "¿Eliminar familia?" },
  "Atenção:": { en: "Warning:", es: "Atención:" },
  "Aparência:": { en: "Appearance:", es: "Apariencia:" },
  "Dados da Casa:": { en: "Household Data:", es: "Datos del Hogar:" },
  "Segurança:": { en: "Security:", es: "Seguridad:" },
  "Mais": { en: "More", es: "Más" },
  "Tema": { en: "Theme", es: "Tema" },
  "Claro": { en: "Light", es: "Claro" },
  "Escuro": { en: "Dark", es: "Oscuro" },
  "Idioma": { en: "Language", es: "Idioma" },
  "Foto da família": { en: "Family photo", es: "Foto de la familia" },
  "Alterar idioma": { en: "Change language", es: "Cambiar idioma" },
  "Português": { en: "Portuguese", es: "Portugués" },
};

const originalText = new WeakMap<Text, string>();
const lastAppliedText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Map<string, string>>();
const lastAppliedAttributes = new WeakMap<Element, Map<string, string>>();
const ignoredTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

function translateTextNode(node: Text, language: string) {
  const parent = node.parentElement;
  if (!parent || ignoredTags.has(parent.tagName) || parent.closest('[data-no-auto-translate="true"]')) return;
  const currentValue = node.nodeValue || '';
  const lastApplied = lastAppliedText.get(node);
  if (!originalText.has(node) || (lastApplied !== undefined && currentValue !== lastApplied) || (lastApplied === undefined && currentValue !== originalText.get(node))) {
    originalText.set(node, currentValue);
  }
  const original = originalText.get(node) || '';
  const trimmed = original.trim();
  if (!trimmed) return;
  const translated = language === 'pt' ? original : dictionary[trimmed]?.[language as 'en' | 'es'];
  if (translated === undefined) return;
  const leading = original.match(/^\s*/)?.[0] || '';
  const trailing = original.match(/\s*$/)?.[0] || '';
  const next = language === 'pt' ? original : leading + translated + trailing;
  if (node.nodeValue !== next) node.nodeValue = next;
  lastAppliedText.set(node, next);
}

function translateAttributes(element: Element, language: string) {
  for (const attribute of ['placeholder', 'title', 'aria-label', 'alt']) {
    const current = element.getAttribute(attribute);
    if (current === null) continue;
    let saved = originalAttributes.get(element);
    if (!saved) {
      saved = new Map<string, string>();
      originalAttributes.set(element, saved);
    }
    let applied = lastAppliedAttributes.get(element);
    if (!applied) {
      applied = new Map<string, string>();
      lastAppliedAttributes.set(element, applied);
    }
    if (!saved.has(attribute) || (applied.has(attribute) && current !== applied.get(attribute))) {
      saved.set(attribute, current);
    }
    const original = saved.get(attribute) || current;
    const translated = language === 'pt' ? original : dictionary[original]?.[language as 'en' | 'es'];
    if (translated !== undefined && current !== translated) element.setAttribute(attribute, translated);
    if (translated !== undefined) applied.set(attribute, translated);
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
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label', 'alt'] });
  i18n.on('languageChanged', apply);
}
