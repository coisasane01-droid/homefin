import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Bill, TransactionType, Attachment, UserSettings } from '../types';
import { generateId, formatCurrency, getMonthName } from '../utils';
import { saasDb } from '../services/saasDb';
import { GoogleGenAI, Type } from '@google/genai';
import { Plus, ChevronLeft, ChevronRight, Copy, Check, X, FileText, Upload, MoreVertical, Trash2, Paperclip, Eye, Download, User, Camera, Loader2, Info } from 'lucide-react';

const Bills: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [bills, setBills] = useState<Bill[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<Partial<Bill>>({});
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{isOpen: boolean, id: string | null}>({isOpen: false, id: null});
  const [duplicateConfirmation, setDuplicateConfirmation] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [appBannerConfig, setAppBannerConfig] = useState(saasDb.getAppBannerConfig());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // Helper to handle legacy categories
  const getCategoryLabel = (cat: string) => {
      if (cat === 'fixed') return 'Fixa';
      if (cat === 'variable') return 'Variável';
      if (cat === 'card') return 'Cartão';
      if (cat === 'tax') return 'Imposto';
      return cat;
  };

  // Filtered Bills
  const filteredBills = bills.filter(b => {
      if (categoryFilter === 'all') return true;
      return getCategoryLabel(b.category) === categoryFilter;
  });

  // Totals
  const total = filteredBills.reduce((acc, b) => acc + b.amount + (b.subCategoryAmount || 0), 0);
  const paid = filteredBills.reduce((acc, b) => {
    if (b.status === 'paid') return acc + b.amount + (b.subCategoryAmount || 0);
    return acc + (b.paidAmount || 0);
  }, 0);
  const pending = total - paid;

  const currentMonthStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  useEffect(() => {
    loadBills();
    loadSettings();
    setAppBannerConfig(saasDb.getAppBannerConfig());
  }, [currentMonthStr]);

  const loadSettings = async () => {
    const s = await db.getSettings();
    setSettings(s);
  };

  const loadBills = async () => {
    setLoading(true);
    const data = await db.getBills(currentMonthStr);
    setBills(data);
    setLoading(false);
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1);
    setCurrentDate(newDate);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBill.description || !editingBill.amount) return;

    const amount = Number(editingBill.amount);
    const paidAmount = Number(editingBill.paidAmount || 0);
    
    let status = editingBill.status || 'pending';
    if (paidAmount >= amount && status === 'pending') {
        status = 'paid';
    } else if (paidAmount < amount && status === 'paid') {
        status = 'pending';
    }

    const billToSave: Bill = {
      id: editingBill.id || generateId(),
      month: currentMonthStr,
      description: editingBill.description,
      amount: amount,
      dueDate: editingBill.dueDate || new Date().toISOString().split('T')[0],
      category: (editingBill.category as TransactionType) || 'fixed',
      status: status,
      createdBy: editingBill.createdBy || '',
      paidBy: editingBill.paidBy || '',
      paidAmount: paidAmount,
      assignedTo: editingBill.assignedTo || '',
      isBold: editingBill.isBold || false,
      subCategory: editingBill.subCategory || '',
      subCategoryAmount: Number(editingBill.subCategoryAmount || 0),
      attachments: editingBill.attachments || [],
      notes: editingBill.notes || ''
    };

    if (editingBill.id) {
      await db.updateBill(billToSave);
    } else {
      await db.addBill(billToSave);
    }
    
    setIsModalOpen(false);
    setEditingBill({});
    loadBills();
  };

  const toggleStatus = async (bill: Bill) => {
    const newStatus = bill.status === 'paid' ? 'pending' : 'paid';
    let paidBy = bill.paidBy;
    let paidAmount = bill.paidAmount;
    
    if (newStatus === 'paid') {
        if (!paidBy) {
            const name = prompt('Quem pagou esta conta?', '');
            if (name !== null) paidBy = name;
        }
        // If it's fully paid, set paidAmount to total amount
        paidAmount = bill.amount;
    } else if (newStatus === 'pending') {
        paidBy = '';
        paidAmount = 0;
    }

    await db.updateBill({ ...bill, status: newStatus, paidBy, paidAmount });
    loadBills();
  };

  const handleDuplicateBill = async (bill: Bill) => {
    const newBill: Bill = {
      ...bill,
      id: generateId(),
      description: `${bill.description} (Cópia)`,
      status: 'pending',
      paidBy: '',
      paidAmount: 0,
      attachments: []
    };
    await db.addBill(newBill);
    loadBills();
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmation({isOpen: true, id});
  };

  const confirmDelete = async () => {
    if (deleteConfirmation.id) {
      await db.deleteBill(deleteConfirmation.id);
      setDeleteConfirmation({isOpen: false, id: null});
      loadBills();
    }
  };

  const duplicateMonth = () => {
    setDuplicateConfirmation(true);
  };

  const confirmDuplicateMonth = async () => {
    const nextMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}`;
    
    for (const bill of bills) {
      // Only duplicate fixed, recurring or custom categories (not one-time variable/card/tax usually)
      // But user said "a categoria fixa ou recorrente permanece no próximo mês"
      // We'll duplicate everything but reset status and paidBy
      
      const newDueDate = new Date(bill.dueDate);
      newDueDate.setMonth(newDueDate.getMonth() + 1);

      await db.addBill({
        ...bill,
        id: generateId(),
        month: nextMonthStr,
        status: 'pending',
        paidBy: '',
        paidAmount: 0,
        dueDate: newDueDate.toISOString().split('T')[0]
      });
    }
    
    setDuplicateConfirmation(false);
    changeMonth(1);
  };

  const openModal = (bill?: Bill) => {
    setEditingBill(bill || { category: 'Fixa', isBold: false, attachments: [], paidAmount: 0 });
    setIsModalOpen(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onloadend = () => {
            const base64String = reader.result as string;
            const newAttachment: Attachment = {
                id: generateId(),
                name: file.name,
                url: base64String,
                type: file.type.includes('image') ? 'image' : (file.type.includes('pdf') ? 'pdf' : 'link')
            };
            
            setEditingBill(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), newAttachment]
            }));
        };
        
        reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            const newAttachment: Attachment = {
                id: generateId(),
                name: file.name,
                url: base64String,
                type: 'image'
            };
            
            setEditingBill(prev => ({
                ...prev,
                attachments: [...(prev.attachments || []), newAttachment]
            }));

            setIsScanning(true);
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const base64Data = base64String.split(',')[1];
                const mimeType = file.type;

                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        parts: [
                            {
                                inlineData: {
                                    data: base64Data,
                                    mimeType: mimeType
                                }
                            },
                            {
                                text: 'Extraia os dados deste comprovante ou conta. Retorne APENAS um JSON válido com os seguintes campos: "description" (nome do estabelecimento ou serviço), "amount" (valor total como número, ex: 150.50), "dueDate" (data de vencimento ou da compra no formato YYYY-MM-DD). Se não encontrar algum campo, retorne null para ele.'
                            }
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                description: { type: Type.STRING },
                                amount: { type: Type.NUMBER },
                                dueDate: { type: Type.STRING }
                            }
                        }
                    }
                });

                if (response.text) {
                    const data = JSON.parse(response.text);
                    setEditingBill(prev => ({
                        ...prev,
                        description: prev.description || data.description || '',
                        amount: prev.amount || data.amount || '',
                        dueDate: prev.dueDate || data.dueDate || prev.dueDate
                    }));
                }
            } catch (error) {
                console.error("Erro ao ler comprovante:", error);
                alert("Não foi possível ler os dados do comprovante automaticamente.");
            } finally {
                setIsScanning(false);
            }
        };
        
        reader.readAsDataURL(file);
    }
  };

  const handleImportStatement = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        const reader = new FileReader();

        setIsImporting(true);
        
        reader.onloadend = async () => {
            try {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const base64String = reader.result as string;
                const base64Data = base64String.split(',')[1];
                const mimeType = file.type || 'text/plain';

                const response = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: {
                        parts: [
                            {
                                inlineData: {
                                    data: base64Data,
                                    mimeType: mimeType
                                }
                            },
                            {
                                text: 'Extraia as transações deste extrato bancário (CSV, OFX ou PDF). Retorne APENAS um JSON válido contendo um array de objetos chamado "transactions". Cada objeto deve ter: "description" (nome do estabelecimento/transação), "amount" (valor absoluto como número positivo), "dueDate" (data no formato YYYY-MM-DD), "category" (classifique como "fixed", "variable", "card" ou "tax"). Ignore transferências entre contas próprias se possível.'
                            }
                        ]
                    },
                    config: {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                transactions: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: {
                                            description: { type: Type.STRING },
                                            amount: { type: Type.NUMBER },
                                            dueDate: { type: Type.STRING },
                                            category: { type: Type.STRING }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                if (response.text) {
                    const data = JSON.parse(response.text);
                    if (data.transactions && Array.isArray(data.transactions)) {
                        let addedCount = 0;
                        for (const t of data.transactions) {
                            if (t.description && t.amount && t.dueDate) {
                                const newBill: Bill = {
                                    id: generateId(),
                                    month: t.dueDate.substring(0, 7),
                                    description: t.description,
                                    amount: t.amount,
                                    dueDate: t.dueDate,
                                    category: (t.category as any) || 'variable',
                                    status: 'paid', // Assumindo que se está no extrato, já foi pago
                                    isBold: false,
                                    attachments: []
                                };
                                await db.addBill(newBill);
                                addedCount++;
                            }
                        }
                        alert(`${addedCount} transações importadas com sucesso!`);
                        loadBills();
                    }
                }
            } catch (error) {
                console.error("Erro ao importar extrato:", error);
                alert("Não foi possível importar o extrato. Verifique o arquivo e tente novamente.");
            } finally {
                setIsImporting(false);
                if (importInputRef.current) importInputRef.current.value = '';
            }
        };
        
        reader.readAsDataURL(file);
    }
  };

  const sortedBills = [...filteredBills].sort((a, b) => {
    const dateA = new Date(a.dueDate).getTime() || 0;
    const dateB = new Date(b.dueDate).getTime() || 0;
    return dateA - dateB;
  });

  return (
    <div className="pb-20 relative">
      {/* Month Navigation - Static on mobile to prevent overlap, sticky on desktop */}
      <div className="md:sticky md:top-0 z-10 bg-gray-50 dark:bg-gray-900 pb-2 pt-2 border-b border-transparent">
        {/* Banner Publicitário */}
        {appBannerConfig.enabled && (
          <a href={appBannerConfig.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full mb-4 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 hover:opacity-90 transition-opacity">
            <img src={appBannerConfig.imageUrl} alt={appBannerConfig.altText} className="w-full h-32 sm:h-40 md:h-48 object-cover" referrerPolicy="no-referrer" />
          </a>
        )}
        <div className="flex justify-between items-center">
            <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <ChevronLeft />
            </button>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold uppercase text-gray-800 dark:text-gray-100">
                  {getMonthName(currentMonthStr)}
              </h2>
              <button 
                onClick={() => setShowInfoModal(true)}
                className="p-1 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors"
                title="Como funciona as Contas do Mês?"
              >
                <Info size={16} />
              </button>
            </div>
            <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors">
                <ChevronRight />
            </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="pt-4 pb-4">
        <div className="grid grid-cols-3 gap-2 md:gap-4 mb-2">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 border-primary-500">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Total</div>
                <div className="font-bold text-gray-900 dark:text-white truncate text-sm md:text-base">{formatCurrency(total)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 border-emerald-500">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Pago</div>
                <div className="font-bold text-emerald-600 truncate text-sm md:text-base">{formatCurrency(paid)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 border-amber-500">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Pendente</div>
                <div className="font-bold text-amber-600 truncate text-sm md:text-base">{formatCurrency(pending)}</div>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-4 mb-4">
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 border-blue-500">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Saldo Atual</div>
                <div className="font-bold text-blue-600 dark:text-blue-400 truncate text-sm md:text-base">{formatCurrency(settings?.currentBalance || 0)}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-sm border-l-4 border-indigo-500">
                <div className="text-[10px] md:text-xs text-gray-500 uppercase font-bold">Saldo Previsto</div>
                <div className={`font-bold truncate text-sm md:text-base ${(settings?.currentBalance || 0) - pending >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency((settings?.currentBalance || 0) - pending)}
                </div>
            </div>
        </div>

        <div className="flex flex-col gap-3">
            <div className="flex justify-between gap-2">
                <div className="flex gap-2">
                    <button 
                        onClick={duplicateMonth}
                        disabled={loading}
                        className="text-xs md:text-sm flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-primary-600 px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 transition-colors"
                    >
                        <Copy size={16} /> <span className="hidden xs:inline">Duplicar</span>
                    </button>
                    <input 
                        type="file" 
                        accept=".csv,.ofx,application/pdf"
                        ref={importInputRef}
                        className="hidden"
                        onChange={handleImportStatement}
                    />
                    <button 
                        onClick={() => importInputRef.current?.click()}
                        disabled={isImporting}
                        className="text-xs md:text-sm flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-emerald-600 px-3 py-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 transition-colors disabled:opacity-50"
                    >
                        {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />} 
                        <span className="hidden xs:inline">{isImporting ? 'Lendo...' : 'Importar Extrato'}</span>
                    </button>
                </div>
                <button 
                    onClick={() => openModal()}
                    className="text-xs md:text-sm flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded shadow hover:bg-primary-700 transition-colors"
                >
                    <Plus size={16} /> Nova Conta
                </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button 
                    onClick={() => setCategoryFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap border ${
                        categoryFilter === 'all' 
                        ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                >
                    Todas
                </button>
                {settings?.categories?.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase transition-all whitespace-nowrap border ${
                            categoryFilter === cat 
                            ? 'bg-primary-600 border-primary-600 text-white shadow-sm' 
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
        </div>
      </div>

      {/* List - Removed overflow-hidden and added margin to prevent cutting off */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm min-h-[200px] mt-4">
        {loading ? (
           <div className="p-8 text-center text-gray-400">Carregando contas...</div>
        ) : bills.length === 0 ? (
            <div className="p-8 text-center text-gray-400 flex flex-col items-center gap-2">
                <FileText size={48} className="opacity-20" />
                <p>Nenhum lançamento neste mês.</p>
                <button onClick={() => openModal()} className="text-primary-600 font-medium hover:underline mt-2">
                  Adicionar primeira conta
                </button>
            </div>
        ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedBills.map((bill, index) => (
                    <div 
                        key={bill.id} 
                        className={`p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${bill.status === 'paid' ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : 'bg-red-50/30 dark:bg-red-900/10'}`}
                    >
                        <div className="flex items-center gap-3 md:gap-4 flex-1">
                            <span className="text-gray-400 text-xs w-6 font-mono">{index + 1}</span>
                            <div 
                                onClick={(e) => { e.stopPropagation(); toggleStatus(bill); }}
                                className={`cursor-pointer rounded-full p-1 border-2 transition-all ${
                                    bill.status === 'paid' 
                                    ? 'bg-emerald-500 border-emerald-500 text-white' 
                                    : 'border-red-400 dark:border-red-500 text-transparent hover:bg-red-50'
                                }`}
                            >
                                <Check size={12} strokeWidth={4} />
                            </div>
                            
                            <div className="flex-1 cursor-pointer" onClick={() => openModal(bill)}>
                                <div className={`flex flex-col md:flex-row md:items-center gap-1 md:gap-2`}>
                                    <span className={`${bill.isBold ? 'font-black text-gray-900 dark:text-white' : 'font-medium text-gray-700 dark:text-gray-200'} text-base leading-tight`}>
                                        {bill.description}
                                    </span>
                                    {bill.attachments && bill.attachments.length > 0 && (
                                        <div className="flex gap-1">
                                            <Paperclip size={12} className="text-gray-400" />
                                            <span className="text-[10px] text-gray-400">({bill.attachments.length})</span>
                                        </div>
                                    )}
                                    {bill.subCategory && (
                                        <span className="text-[10px] uppercase tracking-wider bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                                            {bill.subCategory}
                                            {bill.subCategoryAmount && (
                                                <span className="font-bold border-l border-gray-300 dark:border-gray-600 pl-1 ml-1">
                                                    {formatCurrency(bill.subCategoryAmount)}
                                                </span>
                                            )}
                                        </span>
                                    )}
                                    {bill.assignedTo && (
                                        <span className="text-[10px] uppercase tracking-wider bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full w-fit flex items-center gap-1">
                                            <User size={10} />
                                            {bill.assignedTo}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-2 items-center">
                                    <span className={new Date(bill.dueDate) < new Date() && bill.status === 'pending' ? 'text-red-600 font-black' : ''}>
                                      {new Date(bill.dueDate).toLocaleDateString('pt-BR', {day: '2-digit', month: '2-digit'})}
                                    </span>
                                    <span className="text-gray-300">•</span>
                                    <span className="capitalize">{getCategoryLabel(bill.category)}</span>
                                    {(bill.createdBy || bill.paidBy) && (
                                        <>
                                            <span className="text-gray-300">•</span>
                                            <div className="flex items-center gap-1 text-[10px] font-medium">
                                                <User size={10} />
                                                {bill.status === 'paid' ? (
                                                    <span className="text-emerald-600">Pago por: {bill.paidBy || bill.createdBy || 'Sistema'}</span>
                                                ) : (
                                                    <span>Por: {bill.createdBy || 'Sistema'}</span>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 md:gap-4 pl-2">
                            <div className="flex flex-col items-end">
                                <span className={`font-bold whitespace-nowrap ${bill.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}>
                                    {formatCurrency(bill.amount + (bill.subCategoryAmount || 0))}
                                </span>
                                {bill.status === 'pending' && bill.paidAmount !== undefined && bill.paidAmount > 0 && (
                                    <div className="flex flex-col items-end text-[10px] mt-0.5">
                                        <span className="text-emerald-600 font-medium">Pago: {formatCurrency(bill.paidAmount)}</span>
                                        <span className="text-red-500 font-medium">Falta: {formatCurrency((bill.amount + (bill.subCategoryAmount || 0)) - bill.paidAmount)}</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="relative group">
                                <button className="p-2 -mr-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                                    <MoreVertical size={18} />
                                </button>
                                {/* Dropdown menu simulation */}
                                <div className="absolute right-0 top-full hidden group-hover:block bg-white dark:bg-gray-800 shadow-xl border dark:border-gray-700 rounded-lg p-1 min-w-[140px] z-20">
                                    <button onClick={(e) => { e.stopPropagation(); openModal(bill); }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-200">
                                        <FileText size={16} /> Editar
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDuplicateBill(bill); }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 rounded-md text-gray-700 dark:text-gray-200">
                                        <Copy size={16} /> Duplicar
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(bill.id); }} className="w-full text-left px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 rounded-md">
                                        <Trash2 size={16} /> Excluir
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {/* Modal Edit/Create (z-[100] - Above all) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[95vh] border dark:border-gray-700">
                <div className="p-4 border-b dark:border-gray-700 flex items-center bg-gray-50 dark:bg-gray-800 shrink-0 relative min-h-[64px]">
                    <h3 className="font-bold text-lg dark:text-white pr-12">
                        {editingBill.id ? 'Editar Conta' : 'Nova Conta'}
                    </h3>
                    <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)} 
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/40 hover:text-red-600 rounded-full transition-all text-gray-500 dark:text-gray-400 z-20 shadow-sm active:scale-90"
                        title="Fechar"
                    >
                        <X size={24} strokeWidth={3} />
                    </button>
                </div>
                <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Valor Total (R$)</label>
                            <input 
                                type="number" step="0.01" 
                                required
                                value={editingBill.amount || ''}
                                onChange={e => setEditingBill({...editingBill, amount: parseFloat(e.target.value)})}
                                className="input-field text-xl font-bold text-primary-600"
                                placeholder="0,00"
                                autoFocus={!editingBill.id}
                            />
                        </div>
                        <div>
                            <label className="label">Valor Pago (R$)</label>
                            <input 
                                type="number" step="0.01" 
                                value={editingBill.paidAmount || ''}
                                onChange={e => setEditingBill({...editingBill, paidAmount: parseFloat(e.target.value)})}
                                className="input-field text-xl font-bold text-emerald-600"
                                placeholder="0,00"
                            />
                            {editingBill.amount && editingBill.paidAmount !== undefined && editingBill.paidAmount < editingBill.amount && (
                                <p className="text-xs text-red-500 mt-1 font-medium">
                                    Falta pagar: {formatCurrency(editingBill.amount - editingBill.paidAmount)}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="label">Vencimento</label>
                            <input 
                                type="date" 
                                required
                                value={editingBill.dueDate || new Date().toISOString().split('T')[0]}
                                onChange={e => setEditingBill({...editingBill, dueDate: e.target.value})}
                                className="input-field"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Descrição Principal</label>
                        <input 
                            type="text" 
                            required
                            value={editingBill.description || ''}
                            onChange={e => setEditingBill({...editingBill, description: e.target.value})}
                            className="input-field"
                            placeholder="Ex: Aluguel"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Categoria</label>
                            <select 
                                value={getCategoryLabel(editingBill.category as string)} 
                                onChange={e => setEditingBill({...editingBill, category: e.target.value as TransactionType})}
                                className="input-field"
                            >
                                {settings?.categories?.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label">Subconta / Observação</label>
                            <div className="space-y-2">
                                <input 
                                    type="text"
                                    value={editingBill.subCategory || ''}
                                    onChange={e => setEditingBill({...editingBill, subCategory: e.target.value})}
                                    className="input-field"
                                    placeholder="Ex: Nubank João"
                                />
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-black text-[10px] z-10">R$</span>
                                    <input 
                                        type="number" step="0.01"
                                        value={editingBill.subCategoryAmount || ''}
                                        onChange={e => setEditingBill({...editingBill, subCategoryAmount: parseFloat(e.target.value)})}
                                        className="input-field !pl-14 placeholder:text-[8px] sm:placeholder:text-[10px] uppercase"
                                        placeholder="Valor Parcial"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Status</label>
                            <select 
                                value={editingBill.status} 
                                onChange={e => setEditingBill({...editingBill, status: e.target.value as any})}
                                className={`input-field font-bold ${editingBill.status === 'paid' ? 'text-emerald-600' : 'text-red-600'}`}
                            >
                                <option value="pending">Pendente</option>
                                <option value="paid">Pago</option>
                            </select>
                        </div>
                        <div>
                            <label className="label">Atribuído a (Membro)</label>
                            <select 
                                value={editingBill.assignedTo || ''} 
                                onChange={e => setEditingBill({...editingBill, assignedTo: e.target.value})}
                                className="input-field"
                            >
                                <option value="">Nenhum</option>
                                {settings?.members?.map(member => (
                                    <option key={member} value={member}>{member}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Adicionado por</label>
                            <input 
                                type="text" 
                                value={editingBill.createdBy || ''}
                                onChange={e => setEditingBill({...editingBill, createdBy: e.target.value})}
                                className="input-field"
                                placeholder="Seu nome"
                            />
                        </div>
                        <div>
                            <label className="label">Pago por</label>
                            <input 
                                type="text" 
                                value={editingBill.paidBy || ''}
                                onChange={e => setEditingBill({...editingBill, paidBy: e.target.value})}
                                className="input-field"
                                placeholder="Nome de quem pagou"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                        <input 
                            type="checkbox" 
                            id="isBold"
                            checked={editingBill.isBold || false}
                            onChange={e => setEditingBill({...editingBill, isBold: e.target.checked})}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500 border-gray-300 shrink-0"
                        />
                        <label htmlFor="isBold" className="text-sm font-medium dark:text-gray-300 cursor-pointer select-none">Destacar em Negrito (Prioridade)</label>
                    </div>

                    <div className="border-t dark:border-gray-700 pt-4">
                        <label className="label mb-2 block">Anexos</label>
                        
                        <input 
                            type="file" 
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileSelect}
                        />

                        {editingBill.attachments && editingBill.attachments.length > 0 ? (
                            <div className="space-y-2 mb-3">
                                {editingBill.attachments.map((file, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600">
                                        <div className="flex items-center gap-2 truncate flex-1">
                                            <Paperclip size={14} className="text-gray-400 shrink-0" />
                                            <span className="text-sm truncate dark:text-gray-300">{file.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                type="button"
                                                onClick={() => {
                                                    const win = window.open();
                                                    win?.document.write(`<iframe src="${file.url}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                                }}
                                                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                title="Visualizar"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <a 
                                                href={file.url} 
                                                download={file.name}
                                                className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded transition-colors"
                                                title="Baixar"
                                            >
                                                <Download size={16} />
                                            </a>
                                            <button 
                                                type="button"
                                                onClick={() => setEditingBill(prev => ({
                                                    ...prev, 
                                                    attachments: prev.attachments?.filter((_, i) => i !== idx)
                                                }))}
                                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                title="Remover"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        <input 
                            type="file" 
                            accept="image/*"
                            capture="environment"
                            ref={cameraInputRef}
                            className="hidden"
                            onChange={handleCameraCapture}
                        />

                        <div className="flex gap-2">
                            <button 
                                type="button" 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center gap-2 text-sm text-primary-600 border border-primary-200 bg-primary-50 dark:bg-primary-900/10 dark:border-primary-900/30 rounded-lg px-4 py-3 hover:bg-primary-100 dark:hover:bg-primary-900/30 justify-center border-dashed transition-colors"
                            >
                                <Upload size={18} /> Anexar
                            </button>
                            <button 
                                type="button" 
                                onClick={() => cameraInputRef.current?.click()}
                                disabled={isScanning}
                                className="flex-1 flex items-center gap-2 text-sm text-emerald-600 border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10 dark:border-emerald-900/30 rounded-lg px-4 py-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 justify-center border-dashed transition-colors disabled:opacity-50"
                            >
                                {isScanning ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />} 
                                {isScanning ? 'Lendo...' : 'Escanear'}
                            </button>
                        </div>
                    </div>

                    <div className="pt-2 flex gap-3 pb-2">
                        <button 
                            type="button" 
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 py-3 text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 rounded-xl font-medium transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            className="flex-1 py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-lg shadow-primary-500/30 transition-transform active:scale-[0.98]"
                        >
                            Salvar Conta
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold mb-2 dark:text-white">Excluir Conta?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Esta ação não pode ser desfeita.</p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setDeleteConfirmation({isOpen: false, id: null})} 
                        className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDelete} 
                        className="flex-1 py-2.5 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-500/30"
                    >
                        Excluir
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {duplicateConfirmation && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full">
                <h3 className="text-lg font-bold mb-2 dark:text-white">Copiar Contas?</h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6">Deseja copiar todas as contas deste mês para o próximo mês?</p>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setDuplicateConfirmation(false)} 
                        className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={confirmDuplicateMonth} 
                        className="flex-1 py-2.5 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-500/30"
                    >
                        Copiar
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funcionam as Contas?
              </h2>
              <button 
                onClick={() => setShowInfoModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4 text-sm text-gray-600 dark:text-gray-300 max-h-[60vh] overflow-y-auto">
              <p>
                A página de <strong>Contas do Mês</strong> é o coração do seu controle financeiro. Aqui você gerencia tudo o que entra e sai.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Adicionar Contas:</strong>
                    <p className="mt-1 opacity-90">
                      Use o botão flutuante (+) para cadastrar novas despesas ou receitas. Você pode definir categoria, membro responsável, data de vencimento e até anexar comprovantes.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Check size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Marcar como Pago:</strong>
                    <p className="mt-1 opacity-90">
                      Clique no botão circular ao lado de cada conta para marcá-la como paga. Isso atualizará automaticamente os totais no topo da tela.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <MoreVertical size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Opções Extras:</strong>
                    <p className="mt-1 opacity-90">
                      Clique nos três pontinhos em uma conta para ver opções como Duplicar (útil para contas recorrentes) ou Excluir.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded text-amber-600 dark:text-amber-400 mt-0.5">
                    <Camera size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Leitura Inteligente (IA):</strong>
                    <p className="mt-1 opacity-90">
                      Se você tiver a chave do Gemini configurada, pode usar a câmera ou enviar um comprovante para que a Inteligência Artificial preencha os dados da conta automaticamente!
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

      <style>{`
        .label {
            display: block;
            font-size: 0.875rem;
            font-weight: 500;
            color: #4b5563;
            margin-bottom: 0.25rem;
        }
        .dark .label { color: #d1d5db; }
        .input-field {
            width: 100%;
            padding: 0.75rem 1rem;
            border-radius: 0.75rem;
            border: 1px solid #e5e7eb;
            background-color: white;
            color: #111827;
            transition: all 0.2s;
        }
        .dark .input-field {
            background-color: #374151;
            border-color: #4b5563;
            color: white;
        }
        .input-field:focus {
            outline: none;
            ring: 2px;
            ring-color: #6366f1;
            border-color: #6366f1;
        }
      `}</style>
    </div>
  );
};

export default Bills;