import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { ShoppingItem, Bill, KnownProduct } from '../types';
import { formatCurrency, generateId } from '../utils';
import { Plus, Trash2, ShoppingCart, ArrowRight, Edit2, CheckCircle2, Circle, X, Save, Sparkles, Clock, RefreshCw, Flame, Check, Info, Calendar, Bell } from 'lucide-react';

// Fallback items for new users without history
const SEED_ITEMS = [
  { name: 'Leite', emoji: '🥛' },
  { name: 'Pão', emoji: '🍞' },
  { name: 'Ovos', emoji: '🥚' },
  { name: 'Arroz', emoji: '🍚' },
  { name: 'Feijão', emoji: '🫘' },
  { name: 'Café', emoji: '☕' },
  { name: 'Açúcar', emoji: '🍬' },
  { name: 'Óleo', emoji: '🌻' },
  { name: 'Papel Higiênico', emoji: '🧻' },
  { name: 'Detergente', emoji: '🧼' },
];

const Shopping: React.FC = () => {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemEmoji, setNewItemEmoji] = useState('🛒');
  const [newItemDueDate, setNewItemDueDate] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState(''); // Feedback visual
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    restock: KnownProduct[];
    frequent: KnownProduct[];
    forgotten: KnownProduct[];
  }>({ restock: [], frequent: [], forgotten: [] });
  
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadItems();
    requestNotificationPermission();
  }, []);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      await Notification.requestPermission();
    }
  };

  useEffect(() => {
    if (items.length > 0) {
      checkDueItems();
    }
  }, [items]);

  const checkDueItems = () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    const today = new Date().toDateString();
    const lastNotified = localStorage.getItem('homefin_last_shopping_notification');
    
    if (lastNotified === today) return; // Already notified today

    const dueToday = items.filter(item => !item.checked && item.dueDate && new Date(item.dueDate).toDateString() === today);
    const overdue = items.filter(item => !item.checked && item.dueDate && new Date(item.dueDate) < new Date(new Date().setHours(0,0,0,0)));

    const toNotify = [...overdue, ...dueToday];

    if (toNotify.length > 0) {
      const itemNames = toNotify.slice(0, 3).map(i => i.name).join(', ');
      const moreCount = toNotify.length > 3 ? ` e mais ${toNotify.length - 3}` : '';
      
      new Notification('Lembrete de Compras 🛒', {
        body: `Você precisa comprar hoje: ${itemNames}${moreCount}!`,
        icon: '/favicon.ico'
      });
      
      localStorage.setItem('homefin_last_shopping_notification', today);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    const list = await db.getShoppingList();
    setItems(list);
    
    // Load suggestions in background
    db.getSmartSuggestions().then(sugg => {
        setSuggestions(sugg);
    });
    setLoading(false);
  };

  const showFeedback = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const triggerFeedback = () => {
    setIsError(true);
    if (navigator.vibrate) navigator.vibrate(50);
    inputRef.current?.focus();
    setTimeout(() => setIsError(false), 500);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addItem(newItemName, newItemValue, newItemDueDate);
  };

  const addItem = async (name: string, valueStr: string, dueDateStr: string) => {
    // Validation: Check if empty
    if (!name.trim()) {
      triggerFeedback();
      return;
    }

    let finalName = name.trim();
    if (newItemEmoji && newItemEmoji !== '🛒' && !finalName.startsWith(newItemEmoji)) {
        const firstChar = Array.from(finalName)[0];
        const hasEmoji = /\p{Extended_Pictographic}/u.test(firstChar || '');
        if (!hasEmoji) {
            finalName = `${newItemEmoji} ${finalName}`;
        }
    }

    if (editingId) {
      // Update existing
      const existingItem = items.find(i => i.id === editingId);
      if (existingItem) {
        await db.updateShoppingItem({
          ...existingItem,
          name: finalName,
          estimatedValue: valueStr ? parseFloat(valueStr) : 0,
          dueDate: dueDateStr || undefined
        });
      }
      setEditingId(null);
    } else {
      // Add new
      await db.addShoppingItem({
        id: generateId(),
        name: finalName,
        estimatedValue: valueStr ? parseFloat(valueStr) : 0,
        checked: false,
        dueDate: dueDateStr || undefined
      });
    }

    setNewItemName('');
    setNewItemValue('');
    setNewItemEmoji('🛒');
    setNewItemDueDate('');
    loadItems();
    
    // Keep focus for rapid entry if manual
    if (!editingId && name === newItemName) {
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const addQuickItem = async (name: string, emoji: string) => {
    if (navigator.vibrate) navigator.vibrate(10);
    const fullName = `${emoji} ${name}`;
    await db.addShoppingItem({
        id: generateId(),
        name: fullName,
        estimatedValue: 0,
        checked: false
    });
    loadItems();
  };

  const startEdit = (e: React.MouseEvent, item: ShoppingItem) => {
    e.stopPropagation();
    
    let extractedEmoji = '🛒';
    let extractedName = item.name;
    
    const firstChar = Array.from(item.name)[0];
    if (firstChar && /\p{Extended_Pictographic}/u.test(firstChar)) {
        extractedEmoji = firstChar;
        extractedName = item.name.substring(firstChar.length).trim();
    }

    setNewItemEmoji(extractedEmoji);
    setNewItemName(extractedName);
    setNewItemValue(item.estimatedValue > 0 ? item.estimatedValue.toString() : '');
    setNewItemDueDate(item.dueDate || '');
    setEditingId(item.id);
    
    // Auto focus and scroll
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => inputRef.current?.focus(), 300);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNewItemName('');
    setNewItemValue('');
    setNewItemEmoji('🛒');
    setNewItemDueDate('');
  };

  const toggleCheck = async (id: string) => {
    const item = items.find(i => i.id === id);
    if(item) {
        await db.toggleShoppingItem(id, item.checked);
        loadItems();
    }
  };

  const removeItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await db.deleteShoppingItem(id);
    loadItems();
  };

  const clearCompleted = async () => {
    // Removed confirm to ensure action works on all devices
    const completed = items.filter(i => i.checked);
    if (completed.length === 0) return;

    await db.deleteManyShoppingItems(completed.map(i => i.id));
    loadItems();
    showFeedback('Itens removidos do carrinho');
  };

  const convertToExpense = async () => {
    const checkedItems = items.filter(i => i.checked);
    if (checkedItems.length === 0) return;

    const total = checkedItems.reduce((acc, i) => acc + i.estimatedValue, 0);
    
    // Removed confirms to ensure execution flow
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const itemNames = checkedItems.map(i => i.name).join(', ');

    const bill: Bill = {
      id: generateId(),
      month: monthStr,
      description: 'Compras de Supermercado',
      amount: total,
      dueDate: now.toISOString().split('T')[0],
      category: 'variable',
      status: 'paid',
      isBold: true,
      notes: 'Itens: ' + (itemNames.length > 100 ? itemNames.substring(0, 100) + '...' : itemNames),
      attachments: []
    };

    setLoading(true);
    
    // 1. Create the Bill
    await db.addBill(bill);

    // 2. IMPORTANT: Save Product History before deleting!
    await db.updateProductHistory(checkedItems);
    
    // 3. Remove checked items (Optimized Bulk Delete)
    await db.deleteManyShoppingItems(checkedItems.map(i => i.id));
    
    setLoading(false);
    loadItems();
    showFeedback('Despesa criada com sucesso!');
  };

  const pendingItems = items.filter(i => !i.checked);
  const checkedItems = items.filter(i => i.checked);

  const totalCart = checkedItems.reduce((acc, i) => acc + i.estimatedValue, 0);
  const totalPending = pendingItems.reduce((acc, i) => acc + i.estimatedValue, 0);

  // Check if we have any history to show smart suggestions
  const hasHistory = suggestions.restock.length > 0 || suggestions.frequent.length > 0;

  return (
    <div className="max-w-3xl mx-auto pb-24 relative">
      {/* Toast Feedback */}
      {successMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-in slide-in-from-top-4 fade-in duration-300 w-[90%] max-w-sm">
            <div className="bg-emerald-600 text-white px-4 py-3 rounded-lg shadow-xl flex items-center justify-center gap-2 font-bold">
                <CheckCircle2 size={20} />
                {successMessage}
            </div>
        </div>
      )}

      <div className="flex justify-between items-start mb-6">
        <div>
            <h2 className="text-2xl font-bold dark:text-white flex items-center gap-2">
            <ShoppingCart className="text-primary-600" /> O que acabou?
            <button 
              onClick={() => setShowInfoModal(true)}
              className="p-1.5 text-gray-400 hover:text-primary-500 bg-white dark:bg-gray-800 rounded-full shadow-sm border border-gray-100 dark:border-gray-700 transition-colors ml-2"
              title="Como funciona a Lista?"
            >
              <Info size={18} />
            </button>
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Lembrete do que falta em casa
            </p>
        </div>
        
        {/* Always show badge but style differently if empty */}
        <div className={`px-4 py-2 rounded-lg text-right transition-colors ${checkedItems.length > 0 ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}>
            <p className="text-xs uppercase font-bold">No Carrinho</p>
            <p className="text-lg font-bold">{formatCurrency(totalCart)}</p>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleSave} className={`bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg mb-6 border transition-all duration-300 ${editingId ? 'border-primary-500 ring-1 ring-primary-500' : 'border-gray-100 dark:border-gray-700'}`}>
        <div className="flex flex-col gap-3">
            <div className="flex gap-2">
                <input 
                    type="text"
                    value={newItemEmoji}
                    onChange={e => setNewItemEmoji(e.target.value)}
                    className="w-16 text-center text-2xl bg-gray-50 dark:bg-gray-700 border-0 rounded-lg px-2 py-3 focus:ring-2 ring-primary-500 outline-none"
                    placeholder="🛒"
                    maxLength={2}
                    title="Emoji do item"
                />
                <input 
                    ref={inputRef}
                    type="text" 
                    value={newItemName}
                    onChange={e => {
                        setNewItemName(e.target.value);
                        if (isError) setIsError(false);
                    }}
                    placeholder="Adicionar item manualmente..."
                    className={`flex-1 border-0 rounded-lg px-4 py-3 text-base outline-none transition-all duration-200 ${
                        isError 
                        ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500 placeholder-red-400 animate-pulse' 
                        : 'bg-gray-50 dark:bg-gray-700 focus:ring-2 ring-primary-500 dark:text-white'
                    }`}
                />
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">R$</span>
                    <input 
                        type="number" 
                        value={newItemValue}
                        onChange={e => setNewItemValue(e.target.value)}
                        placeholder="Valor Estimado (opcional)"
                        step="0.01"
                        className="w-full bg-gray-50 dark:bg-gray-700 border-0 rounded-lg pl-10 pr-4 py-3 focus:ring-2 ring-primary-500 dark:text-white text-base"
                    />
                </div>
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Calendar size={18} />
                    </span>
                    <input 
                        type="date" 
                        value={newItemDueDate}
                        onChange={e => setNewItemDueDate(e.target.value)}
                        className="w-full bg-gray-50 dark:bg-gray-700 border-0 rounded-lg pl-10 pr-4 py-3 focus:ring-2 ring-primary-500 dark:text-white text-base text-gray-500"
                        title="Data limite para compra (Lembrete)"
                    />
                </div>
            </div>
            
            <div className="flex gap-2">
                {editingId && (
                    <button 
                        type="button" 
                        onClick={cancelEdit}
                        className="flex-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 p-3 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                        Cancelar
                    </button>
                )}
                <button 
                    type="submit" 
                    disabled={loading}
                    className={`flex-1 ${editingId ? 'bg-primary-600' : 'bg-primary-600'} text-white p-3 rounded-lg font-bold hover:bg-primary-700 shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2`}
                >
                    {editingId ? <><Save size={18} /> Salvar Alteração</> : <><Plus size={18} /> Adicionar</>}
                </button>
            </div>
        </div>
      </form>

      {/* --- SMART SUGGESTIONS --- */}
      {!editingId && (
        <div className="mb-8 space-y-4">
            
            {/* 1. Restock Suggestions (Items bought often but not recently) */}
            {suggestions.restock.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <Clock size={16} className="text-amber-500" />
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Hora de Repor?</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-4 px-1 snap-x scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0">
                        {suggestions.restock.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => addQuickItem(item.name, item.emoji || '🛒')}
                                className="snap-start flex-shrink-0 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 rounded-full px-4 py-2 text-sm font-medium text-amber-800 dark:text-amber-200 shadow-sm hover:border-amber-300 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                                <span>{item.emoji}</span>
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 2. Frequent Items (If history exists) or Seed Data (If new) */}
            <div>
                 <div className="flex items-center gap-2 mb-2 px-1">
                    {hasHistory ? <Flame size={16} className="text-primary-500" /> : <Sparkles size={16} className="text-primary-500" />}
                    <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {hasHistory ? 'Mais Frequentes' : 'Sugestões Rápidas'}
                    </span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-4 px-1 snap-x scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0">
                    {hasHistory ? (
                         suggestions.frequent.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => addQuickItem(item.name, item.emoji || '🛒')}
                                className="snap-start flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                                <span>{item.emoji}</span>
                                <span>{item.name}</span>
                            </button>
                        ))
                    ) : (
                        SEED_ITEMS.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => addQuickItem(item.name, item.emoji)}
                                className="snap-start flex-shrink-0 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:border-primary-300 dark:hover:border-primary-700 hover:text-primary-600 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                                <span>{item.emoji}</span>
                                <span>{item.name}</span>
                            </button>
                        ))
                    )}
                </div>
            </div>

             {/* 3. Forgotten Items (Long time no see) */}
             {suggestions.forgotten.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <RefreshCw size={16} className="text-blue-500" />
                        <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Esqueceu disso?</span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-4 px-1 snap-x scrollbar-hide -mx-4 md:mx-0 px-4 md:px-0">
                        {suggestions.forgotten.map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => addQuickItem(item.name, item.emoji || '🛒')}
                                className="snap-start flex-shrink-0 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700/50 rounded-full px-4 py-2 text-sm font-medium text-blue-800 dark:text-blue-200 shadow-sm hover:border-blue-300 active:scale-95 transition-all flex items-center gap-2 whitespace-nowrap"
                            >
                                <span>{item.emoji}</span>
                                <span>{item.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      )}

      <div className="space-y-6">
        {/* Pending Items Section */}
        {pendingItems.length > 0 && (
            <div>
                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 ml-1 flex justify-between">
                    <span>Falta Comprar ({pendingItems.length})</span>
                    <span>{formatCurrency(totalPending)}</span>
                </h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {pendingItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 group hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer" onClick={() => toggleCheck(item.id)}>
                        <div className="flex items-center gap-3 flex-1">
                            <div className="text-gray-400 hover:text-primary-500 transition-colors">
                                <Circle size={24} strokeWidth={1.5} />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-gray-800 dark:text-white font-medium text-lg">{item.name}</span>
                                <div className="flex items-center gap-2">
                                    {item.estimatedValue > 0 && (
                                        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                                            {formatCurrency(item.estimatedValue)}
                                        </span>
                                    )}
                                    {item.dueDate && (
                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                            new Date(item.dueDate) < new Date(new Date().setHours(0,0,0,0)) 
                                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                            : new Date(item.dueDate).toDateString() === new Date().toDateString()
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        }`}>
                                            <Bell size={10} />
                                            {new Date(item.dueDate).toLocaleDateString('pt-BR')}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={(e) => startEdit(e, item)} 
                                className="p-3 text-gray-400 hover:text-primary-600 transition-colors bg-transparent hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                            >
                                <Edit2 size={20} />
                            </button>
                            <button 
                                onClick={(e) => removeItem(e, item.id)} 
                                className="p-3 text-gray-400 hover:text-red-500 transition-colors bg-transparent hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}

        {/* Checked Items Section */}
        {checkedItems.length > 0 && (
            <div className="opacity-90">
                <div className="flex justify-between items-end mb-3 ml-1">
                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                        <span>No Carrinho ({checkedItems.length})</span>
                    </h3>
                    <button onClick={clearCompleted} className="text-xs text-red-500 hover:text-red-700 hover:underline">
                        Limpar Concluídos
                    </button>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl shadow-inner border border-gray-100 dark:border-gray-700/50 overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {checkedItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-4 hover:bg-gray-100 dark:hover:bg-gray-700/30 transition-colors cursor-pointer" onClick={() => toggleCheck(item.id)}>
                        <div className="flex items-center gap-3 flex-1">
                             <div className="text-emerald-500">
                                <CheckCircle2 size={24} strokeWidth={2} className="fill-emerald-100 dark:fill-emerald-900/30" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-gray-500 dark:text-gray-400 line-through decoration-gray-400 font-medium">{item.name}</span>
                                {/* Mostrar valor se houver */}
                                {item.estimatedValue === 0 && (
                                    <span className="text-[10px] text-amber-500 font-bold">Sem valor</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                             <span className="text-sm font-bold text-gray-600 dark:text-gray-400">
                                {formatCurrency(item.estimatedValue)}
                             </span>
                             <div className="flex items-center">
                                <button onClick={(e) => startEdit(e, item)} className="p-2 text-gray-300 hover:text-primary-500 transition-colors" aria-label="Editar">
                                    <Edit2 size={16} />
                                </button>
                                <button onClick={(e) => removeItem(e, item.id)} className="p-2 text-gray-300 hover:text-red-400 transition-colors" aria-label="Remover">
                                    <X size={18} />
                                </button>
                             </div>
                        </div>
                    </div>
                    ))}
                </div>
            </div>
        )}

        {items.length === 0 && !loading && (
             <div className="p-12 text-center text-gray-400 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-300 dark:border-gray-700">
                <ShoppingCart size={48} className="mx-auto mb-4 opacity-20" />
                <p className="font-medium">Tudo em ordem por aqui!</p>
                <p className="text-sm mt-2 opacity-70">Toque nas sugestões acima quando algo acabar.</p>
            </div>
        )}
      </div>

      {checkedItems.length > 0 && (
        <div className="fixed bottom-6 right-4 left-4 md:left-auto md:right-8 z-20">
            <button 
                onClick={convertToExpense}
                disabled={loading}
                className="w-full md:w-auto bg-emerald-600 text-white px-6 py-4 rounded-xl shadow-xl hover:bg-emerald-700 flex items-center justify-center gap-3 font-bold transition-transform active:scale-95 animate-in slide-in-from-bottom-4"
            >
                <div className="flex flex-col items-start leading-tight">
                    <span className="text-[10px] uppercase opacity-90 font-semibold">Finalizar Compra</span>
                    <span className="text-lg">Gerar Despesa</span>
                </div>
                <div className="h-8 w-px bg-white/20 mx-1"></div>
                <div className="text-xl">{formatCurrency(totalCart)}</div>
                <ArrowRight size={20} /> 
            </button>
        </div>
      )}
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
        .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
        }
      `}</style>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                <Info className="text-primary-500" /> Como funciona a Lista?
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
                A <strong>Lista de Compras</strong> é inteligente e aprende com os seus hábitos de consumo para facilitar suas idas ao mercado.
              </p>
              
              <div className="space-y-3 mt-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-1.5 rounded text-blue-600 dark:text-blue-400 mt-0.5">
                    <Plus size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Adicionar Itens:</strong>
                    <p className="mt-1 opacity-90">
                      Digite o nome do produto, escolha um emoji e informe o valor estimado. O app vai somando tudo para você saber quanto vai gastar antes mesmo de chegar ao caixa.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-emerald-100 dark:bg-emerald-900/30 p-1.5 rounded text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Sugestões Inteligentes:</strong>
                    <p className="mt-1 opacity-90">
                      Com o tempo, o app sugere itens que você costuma comprar com frequência, produtos que podem estar acabando (com base no tempo desde a última compra) e itens que você não compra há muito tempo.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-1.5 rounded text-purple-600 dark:text-purple-400 mt-0.5">
                    <ArrowRight size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Finalizar Compra:</strong>
                    <p className="mt-1 opacity-90">
                      Ao marcar os itens que você pegou no mercado, clique em "Finalizar Compra". O app vai transformar esses itens em uma <strong>Despesa Paga</strong> automaticamente no seu fluxo de caixa!
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 mt-4">
                  <div className="bg-amber-100 dark:bg-amber-900/30 p-1.5 rounded text-amber-600 dark:text-amber-400 mt-0.5">
                    <Calendar size={16} />
                  </div>
                  <div>
                    <strong className="text-gray-800 dark:text-gray-200 block">Lembretes de Compra:</strong>
                    <p className="mt-1 opacity-90">
                      Adicione uma data limite para comprar um item. O aplicativo enviará uma notificação para o seu dispositivo lembrando você de comprar os itens no dia programado!
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
    </div>
  );
};

export default Shopping;