import React, { useState, useEffect } from 'react';
import { BarChart3, Download, FileSpreadsheet, Printer, Info, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { db } from '../services/db';
import { formatCurrency } from '../utils';

const Reports: React.FC = () => {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);
  const [reportSettings, setReportSettings] = useState<any>(null);
  const [showPdfInstructions, setShowPdfInstructions] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [bills, settings] = await Promise.all([
      db.getAllBills(),
      db.getSettings()
    ]);
    
    setRawData(bills);
    setReportSettings(settings);

    // Group by month and status
    const monthlyData = bills.reduce((acc: any, bill) => {
        const month = bill.month;
        if (!acc[month]) acc[month] = { name: month, pago: 0, pendente: 0 };
        
        const amount = bill.amount + (bill.subCategoryAmount || 0);
        
        if (bill.status === 'paid') {
            acc[month].pago += amount;
        } else {
            const paidAmount = bill.paidAmount || 0;
            acc[month].pago += paidAmount;
            acc[month].pendente += (amount - paidAmount);
        }
        return acc;
    }, {});

    const sortedData = Object.values(monthlyData).sort((a: any, b: any) => a.name.localeCompare(b.name));
    setChartData(sortedData);
    setLoading(false);
  };

  const handleExportCSV = () => {
    if (rawData.length === 0) {
        alert("Sem dados para exportar.");
        return;
    }

    // Helper for translation
    const getCategoryLabel = (cat: string) => {
        if (cat === 'fixed') return 'Fixa';
        if (cat === 'variable') return 'Variável';
        if (cat === 'card') return 'Cartão';
        if (cat === 'tax') return 'Imposto';
        return cat;
    };

    const getStatusLabel = (status: string) => {
        return status === 'paid' ? 'Pago' : 'Pendente';
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const [year, month, day] = dateStr.split('-');
        return `${day}/${month}/${year}`;
    };

    // CSV Header (using semicolon for better Excel compatibility in Brazil)
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID;Descrição;Valor;Vencimento;Categoria;Status\n";

    // CSV Rows
    rawData.forEach((bill) => {
        const amount = (bill.amount + (bill.subCategoryAmount || 0)).toFixed(2).replace('.', ',');
        const row = [
            bill.id,
            `"${bill.description}"`,
            `"${amount}"`,
            formatDate(bill.dueDate),
            getCategoryLabel(bill.category),
            getStatusLabel(bill.status)
        ].join(";");
        csvContent += row + "\n";
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_financeiro.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    setShowPdfInstructions(true);
  };

  const confirmPrint = () => {
    setShowPdfInstructions(false);
    // Call print immediately to ensure it's not blocked by browser security policies regarding user gestures
    // The modal has 'print:hidden' so it won't appear in the PDF
    window.print();
  };

  return (
    <div className="pb-20">
      {/* PDF Instructions Modal */}
      {showPdfInstructions && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200 print:hidden">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <div className="flex items-center gap-3 mb-4 text-primary-600 dark:text-primary-400">
                    <Download size={28} />
                    <h3 className="text-lg font-bold dark:text-white">Baixar PDF</h3>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm leading-relaxed">
                    Para salvar o relatório como PDF:
                    <br/><br/>
                    1. Clique em <b>Continuar</b> abaixo.
                    <br/>
                    2. Na janela de impressão que abrir, mude o <b>Destino</b> para <b>"Salvar como PDF"</b>.
                    <br/>
                    3. Clique em <b>Salvar</b>.
                </p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setShowPdfInstructions(false)} 
                        className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmPrint} 
                        className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[120] print:hidden">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funcionam os Relatórios?
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300">
              <p>
                A área de <strong>Relatórios</strong> oferece uma visão geral da sua saúde financeira através de gráficos e exportação de dados.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <BarChart3 size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Gráficos de Despesas:</strong>
                    <p className="mt-1 opacity-90">
                      Visualize o fluxo das suas despesas ao longo dos meses. O gráfico compara o que já foi "Pago" com o que ainda está "Pendente", ajudando a entender seus gastos.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Exportar para Excel (CSV):</strong>
                    <p className="mt-1 opacity-90">
                      Baixe todos os dados das suas despesas em formato CSV. Você pode abrir este arquivo no Excel, Google Sheets ou Numbers para fazer suas próprias análises e tabelas dinâmicas.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <Printer size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Imprimir / Salvar PDF:</strong>
                    <p className="mt-1 opacity-90">
                      Gere um relatório formatado para impressão. Se você configurou um logo e nome da casa nas "Configurações", eles aparecerão no cabeçalho do documento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex justify-end">
              <button 
                onClick={() => setShowInfoModal(false)}
                className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="hidden print:block mb-8 border-b-2 border-primary-600 pb-4">
        <div className="flex items-center gap-4">
            {reportSettings?.logoImage ? (
                <img 
                    src={reportSettings.logoImage} 
                    alt="Logo" 
                    className="w-20 h-20 object-contain rounded-lg"
                    style={{
                        objectPosition: reportSettings.logoPosition || 'center',
                        transform: `scale(${(reportSettings.logoZoom || 100) / 100})`
                    }}
                />
            ) : (
                <div className="w-20 h-20 bg-primary-100 rounded-lg flex items-center justify-center text-primary-600 font-bold text-2xl">
                    {reportSettings?.houseName?.charAt(0) || 'C'}
                </div>
            )}
            <div>
                <h1 className="text-3xl font-bold text-gray-900">{reportSettings?.houseName || 'Minha Casa'}</h1>
                <p className="text-gray-500 text-sm">Relatório Financeiro Gerado em {new Date().toLocaleDateString('pt-BR')}</p>
            </div>
        </div>
      </div>

      <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2 mb-6 print:hidden">
        <BarChart3 className="text-primary-600" /> Relatórios
        <button 
          onClick={() => setShowInfoModal(true)}
          className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
          title="Como funcionam os Relatórios?"
        >
          <Info size={18} />
        </button>
      </h2>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 mb-8 print:shadow-none print:border-none print:p-0">
        <h3 className="text-lg font-bold mb-6 text-gray-800 dark:text-white print:text-xl print:mb-4">Fluxo de Despesas (Pago vs Pendente)</h3>
        <div className="h-80 w-full print:h-64">
            {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400">Carregando dados...</div>
            ) : chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                    <XAxis 
                        dataKey="name" 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => {
                            const [year, month] = value.split('-');
                            const date = new Date(parseInt(year), parseInt(month) - 1);
                            return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
                        }}
                    />
                    <YAxis 
                        stroke="#888888" 
                        fontSize={12} 
                        tickLine={false} 
                        axisLine={false} 
                        tickFormatter={(value) => `R$${value}`} 
                    />
                    <Tooltip 
                        formatter={(value: number) => [formatCurrency(value), '']}
                        labelFormatter={(label) => {
                            const [year, month] = label.split('-');
                            const date = new Date(parseInt(year), parseInt(month) - 1);
                            return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
                        }}
                        contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Bar dataKey="pago" name="Pago" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="pendente" name="Pendente" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
                </ResponsiveContainer>
            ) : (
                <div className="h-full flex items-center justify-center text-gray-400">Sem dados suficientes</div>
            )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 print:hidden">
        <button 
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 py-4 rounded-xl font-bold transition-colors"
        >
            <Download size={20} /> Baixar PDF
        </button>
        <button 
            onClick={handleExportCSV}
            className="flex-1 flex items-center justify-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 py-4 rounded-xl font-bold transition-colors"
        >
            <FileSpreadsheet size={20} /> Exportar Excel (CSV)
        </button>
      </div>

      {/* Tabela visível apenas na impressão */}
      <div className="hidden print:block mt-8">
          <h3 className="text-xl font-bold mb-4 border-b pb-2">Detalhamento de Lançamentos</h3>
          <table className="w-full text-left text-xs">
              <thead>
                  <tr className="border-b-2 border-gray-300 bg-gray-50">
                      <th className="py-2 px-2 font-bold uppercase text-gray-600">Data</th>
                      <th className="py-2 px-2 font-bold uppercase text-gray-600">Descrição</th>
                      <th className="py-2 px-2 font-bold uppercase text-gray-600">Categoria</th>
                      <th className="py-2 px-2 font-bold uppercase text-gray-600 text-center">Status</th>
                      <th className="py-2 px-2 font-bold uppercase text-gray-600 text-right">Valor</th>
                  </tr>
              </thead>
              <tbody>
                  {rawData.sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime()).map((bill, index) => (
                      <tr key={bill.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="py-2 px-2">{new Date(bill.dueDate).toLocaleDateString('pt-BR')}</td>
                          <td className="py-2 px-2 font-medium">{bill.description}</td>
                          <td className="py-2 px-2 capitalize">{
                              bill.category === 'fixed' ? 'Fixa' : 
                              bill.category === 'variable' ? 'Variável' : 
                              bill.category === 'card' ? 'Cartão' : 
                              bill.category === 'tax' ? 'Imposto' : bill.category
                          }</td>
                          <td className="py-2 px-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  bill.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                  {bill.status === 'paid' ? 'Pago' : 'Pendente'}
                              </span>
                          </td>
                          <td className={`py-2 px-2 text-right font-bold ${bill.status === 'paid' ? 'text-green-700' : 'text-amber-700'}`}>
                              {formatCurrency(bill.amount + (bill.subCategoryAmount || 0))}
                          </td>
                      </tr>
                  ))}
              </tbody>
              <tfoot>
                  <tr className="border-t-2 border-gray-300 font-bold bg-gray-100">
                      <td colSpan={4} className="py-3 px-2 text-right uppercase">Total Geral</td>
                      <td className="py-3 px-2 text-right text-lg">
                          {formatCurrency(rawData.reduce((acc, bill) => acc + bill.amount + (bill.subCategoryAmount || 0), 0))}
                      </td>
                  </tr>
              </tfoot>
          </table>
          
          <div className="mt-8 text-center text-xs text-gray-400 border-t pt-4">
              <p>Relatório gerado automaticamente pelo sistema {reportSettings?.houseName || 'HomeFin'}.</p>
          </div>
      </div>
    </div>
  );
};

export default Reports;