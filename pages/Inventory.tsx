import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Package, Plus,
  Search, Trash2, Pencil, RefreshCw, X, List, CheckCircle2,
} from 'lucide-react';
import { inventoryService } from '../services/inventory';
import InventorySharingPanel from '../components/InventorySharingPanel';
import type { InventoryProduct, InventoryMovementType, InventoryData } from '../types/inventory';
import { formatCurrency } from '../utils';

type SelectedItem = {
  productId: string;
  quantity: number;
  priceType: 'retail' | 'wholesale';
  unitPrice: number;
};

const blankProduct = (): InventoryProduct => ({
  id: crypto.randomUUID(),
  name: '',
  sku: '',
  category: '',
  supplier: '',
  quantity: 0,
  minimumQuantity: 0,
  costPrice: 0,
  salePrice: 0,
  wholesalePrice: 0,
  updatedAt: new Date().toISOString(),
});

const moneyInput = (value: number) => String(value || 0).replace('.', ',');
const parseMoney = (value: string) => {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  return normalized === '' ? 0 : Number(normalized);
};

const Inventory: React.FC = () => {
  const familyId = localStorage.getItem('homefin_current_family_id') || '';
  const [data, setData] = useState<InventoryData>({ products: [], movements: [] });
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [movementProduct, setMovementProduct] = useState<InventoryProduct | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovementType>('entry');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementNote, setMovementNote] = useState('');
  const [entryPicker, setEntryPicker] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchNote, setBatchNote] = useState('');

  const reload = async () => {
    if (!familyId || familyId === 'v1') {
      setMessage('Entre na sua família para acessar o Estoque.');
      setLoading(false);
      return;
    }
    try {
      const result = await inventoryService.load(familyId);
      setData({
        products: result.data.products.map(p => ({
          ...p,
          costPrice: Number(p.costPrice ?? 0),
          salePrice: Number(p.salePrice ?? 0),
          wholesalePrice: Number(p.wholesalePrice ?? 0),
        })),
        movements: result.data.movements,
      });
      setSynced(result.synced);
      if (result.error) setMessage(result.error);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível carregar o Estoque.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
    const handleOnline = () => void reload();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'F12') {
        event.preventDefault();
        setTableOpen(value => !value);
      }
      if (event.key === 'Escape') {
        setTableOpen(false);
        setEntryPicker(false);
      }
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  const filtered = useMemo(() => data.products.filter(p => {
    const term = search.trim().toLowerCase();
    const matches = !term || `${p.name} ${p.sku} ${p.category} ${p.supplier}`.toLowerCase().includes(term);
    const status = filter === 'low' ? p.quantity <= p.minimumQuantity :
      filter === 'available' ? p.quantity > p.minimumQuantity : true;
    return matches && status;
  }), [data.products, search, filter]);

  const suggestions = useMemo(() => {
    if (!search.trim()) return [];
    return data.products
      .filter(p => `${p.name} ${p.sku} ${p.category} ${p.supplier}`.toLowerCase().includes(search.trim().toLowerCase()))
      .slice(0, 8);
  }, [data.products, search]);

  const zeroStock = data.products.filter(p => p.quantity <= 0);
  const lowCount = data.products.filter(p => p.quantity <= p.minimumQuantity).length;

  const highExitAlerts = useMemo(() => {
    const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const totals = new Map<string, number>();
    data.movements.forEach(m => {
      if (m.type !== 'exit' || new Date(m.createdAt).getTime() < since) return;
      totals.set(m.productId, (totals.get(m.productId) || 0) + m.quantity);
    });
    return data.products
      .filter(p => p.quantity <= 0 && (totals.get(p.id) || 0) > 0)
      .map(p => ({ product: p, exits: totals.get(p.id) || 0 }))
      .sort((a, b) => b.exits - a.exits)
      .slice(0, 5);
  }, [data.products, data.movements]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editing.name.trim()) return;
    const salePrice = Number(editing.salePrice ?? 0);
    const wholesalePrice = Number(editing.wholesalePrice ?? 0);
    if (![salePrice, wholesalePrice].every(v => Number.isFinite(v) && v >= 0 && v <= 1e9)) {
      setMessage('Confira os preços de varejo e atacado.');
      return;
    }
    const result = await inventoryService.saveProduct(familyId, {
      ...editing,
      costPrice: Number(editing.costPrice ?? 0),
      salePrice,
      wholesalePrice,
      updatedAt: new Date().toISOString(),
    });
    setData({ products: result.data.products, movements: result.data.movements });
    setSynced(result.synced);
    setEditing(null);
    setMessage(result.synced
      ? 'Produto salvo e confirmado na nuvem.'
      : result.error || 'Produto salvo neste aparelho; sincronização pendente.');
  };

  const move = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!movementProduct) return;
    const quantity = Number(movementQuantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      setMessage('Informe uma quantidade inteira maior que zero.');
      return;
    }
    try {
      await inventoryService.move(familyId, movementProduct.id, movementType, quantity, movementNote);
      await reload();
      setMovementProduct(null);
      setMovementQuantity('1');
      setMovementNote('');
      setEntryPicker(false);
      setMessage(movementType === 'entry'
        ? 'Entrada registrada e confirmada na nuvem.'
        : 'Saída registrada e confirmada na nuvem.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a movimentação.');
    }
  };

  const remove = async (product: InventoryProduct) => {
    if (!window.confirm(`Excluir "${product.name}"? O histórico relacionado também será removido.`)) return;
    const result = await inventoryService.deleteProduct(familyId, product.id);
    setData({ products: result.data.products, movements: result.data.movements });
    setSynced(result.synced);
    setSelectedItems(items => items.filter(item => item.productId !== product.id));
    setMessage(result.synced
      ? 'Produto excluído e confirmado na nuvem.'
      : result.error || 'Exclusão pendente de sincronização.');
  };

  const addSelected = (product: InventoryProduct) => {
    if (selectedItems.some(item => item.productId === product.id)) {
      setMessage(`${product.name} já está na lista.`);
      return;
    }
    setSelectedItems(items => [...items, {
      productId: product.id,
      quantity: 1,
      priceType: 'retail',
      unitPrice: Number(product.salePrice ?? 0),
    }]);
    setSearch('');
    setShowSuggestions(false);
    setMessage(`${product.name} adicionado à lista.`);
  };

  const updateSelected = (productId: string, changes: Partial<SelectedItem>) => {
    setSelectedItems(items => items.map(item =>
      item.productId === productId ? { ...item, ...changes } : item
    ));
  };

  const addItemsToStockOut = async () => {
    if (!selectedItems.length || batchBusy) return;

    for (const item of selectedItems) {
      const product = data.products.find(p => p.id === item.productId);

      if (!product) {
        setMessage('Um produto da lista não foi encontrado. Atualize o Estoque.');
        return;
      }

      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        setMessage(`Informe uma quantidade válida para ${product.name}.`);
        return;
      }

      if (item.quantity > product.quantity) {
        setMessage(`Estoque insuficiente para ${product.name}. Disponível: ${product.quantity}.`);
        return;
      }
    }

    setBatchBusy(true);

    try {
      const totalItems = selectedItems.length;

      await inventoryService.moveBatch(
        familyId,
        selectedItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        batchNote.trim() || 'Saída registrada pela lista do Estoque'
      );

      // O servidor confirmou a operação atômica.
      // Limpar imediatamente evita repetir a baixa se o reload falhar.
      setSelectedItems([]);
      setBatchNote('');
      setMessage(
        `${totalItems} produto(s) baixado(s) e confirmado(s) na nuvem.`
      );

      await reload();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a baixa. A lista foi preservada.'
      );
    } finally {
      setBatchBusy(false);
    }
  };

  const openMovement = (product: InventoryProduct, type: InventoryMovementType) => {
    setMovementProduct(product);
    setMovementType(type);
    setMovementQuantity('1');
    setMovementNote('');
  };

  if (loading) return <div className="p-8 text-center">Carregando Estoque...</div>;

  const selectedTotal = selectedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

  return (
    <div className="space-y-5 p-3 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque</h1>
          <p className="text-sm text-gray-500">Controle de produtos, entradas e saídas</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button onClick={() => setEntryPicker(true)}
            className="col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-4 text-base font-extrabold text-white shadow hover:bg-emerald-700 sm:col-span-1">
            <ArrowDownToLine size={21}/> ENTRADA NO ESTOQUE
          </button>
          <button onClick={() => setEditing(blankProduct())}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white">
            <Plus size={18}/> Novo produto
          </button>
          <button onClick={() => setTableOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 font-semibold dark:border-gray-700">
            <List size={18}/> TABELA / F12
          </button>
        </div>
      </header>

      <InventorySharingPanel familyId={familyId} onAccessChange={() => void reload()} />

      {message && <div className="flex items-start justify-between gap-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
        <span>{message}</span>
        <button onClick={() => setMessage('')} aria-label="Fechar aviso"><X size={17}/></button>
      </div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="rounded-xl border p-4 dark:border-gray-700">
          <p className="text-sm text-gray-500">Produtos cadastrados</p>
          <strong className="text-2xl">{data.products.length}</strong>
        </div>
        <div className="rounded-xl border p-4 dark:border-gray-700">
          <p className="text-sm text-gray-500">Abaixo do mínimo</p>
          <strong className="text-2xl text-amber-600">{lowCount}</strong>
        </div>
        <div className="col-span-2 rounded-xl border p-4 dark:border-gray-700 md:col-span-1">
          <p className="text-sm text-gray-500">Sem estoque</p>
          <strong className="text-2xl text-red-600">{zeroStock.length}</strong>
        </div>
      </div>

      {(zeroStock.length > 0 || highExitAlerts.length > 0) && <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
        <h2 className="mb-2 flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
          <AlertTriangle size={19}/> Alertas de reposição
        </h2>
        {zeroStock.length > 0 && <p className="mb-2 text-sm">{zeroStock.length} produto(s) estão sem estoque.</p>}
        {highExitAlerts.length > 0 && <>
          <p className="mb-2 text-sm font-semibold">Sem estoque com mais saídas registradas nos últimos 30 dias:</p>
          <div className="space-y-1 text-sm">
            {highExitAlerts.map(({ product, exits }) => <div key={product.id} className="flex justify-between gap-3">
              <span>{product.name}</span><strong>{exits} saída(s)</strong>
            </div>)}
          </div>
        </>}
      </section>}

      <section className="space-y-3 rounded-2xl border p-4 dark:border-gray-700">
        <div>
          <h2 className="font-bold">Pesquisar e selecionar produtos</h2>
          <p className="text-xs text-gray-500">Digite o nome, código ou categoria e selecione um produto para adicionar à lista de saída.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-3.5 text-gray-400" size={19}/>
          <input value={search}
            onChange={e => { setSearch(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && suggestions[0]) {
                e.preventDefault();
                addSelected(suggestions[0]);
              }
              if (e.key === 'Escape') setShowSuggestions(false);
            }}
            placeholder="Pesquisar produto..."
            className="w-full rounded-xl border py-3 pl-11 pr-3 dark:border-gray-700 dark:bg-gray-900"/>
          {showSuggestions && suggestions.length > 0 && <div className="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            {suggestions.map(p => <button key={p.id} onClick={() => addSelected(p)}
              className="flex w-full items-center justify-between gap-3 border-b p-3 text-left last:border-0 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
              <span className="min-w-0"><strong className="block truncate">{p.name}</strong><small className="text-gray-500">{p.sku || p.category || 'Sem código'}</small></span>
              <span className={`shrink-0 text-sm font-bold ${p.quantity <= p.minimumQuantity ? 'text-amber-600' : 'text-emerald-600'}`}>{p.quantity} disponível</span>
            </button>)}
          </div>}
        </div>

        {selectedItems.length > 0 && <div className="space-y-3 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-bold">Itens selecionados ({selectedItems.length})</h3>
            <button onClick={() => setSelectedItems([])} disabled={batchBusy} className="text-sm text-red-600">Limpar lista</button>
          </div>
          {selectedItems.map(item => {
            const p = data.products.find(product => product.id === item.productId);
            if (!p) return null;
            return <div key={item.productId} className="rounded-xl border p-3 dark:border-gray-700">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0"><strong className="block">{p.name}</strong><small className="text-gray-500">Disponível: {p.quantity}</small></div>
                <button onClick={() => setSelectedItems(items => items.filter(x => x.productId !== item.productId))} disabled={batchBusy} className="rounded-lg p-2 text-red-500"><Trash2 size={17}/></button>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label className="text-xs text-gray-500">Quantidade
                  <input type="number" min="1" step="1" value={item.quantity}
                    onChange={e => updateSelected(p.id, { quantity: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-900"/>
                </label>
                <label className="text-xs text-gray-500">Tabela de preço
                  <select value={item.priceType} onChange={e => {
                    const type = e.target.value as SelectedItem['priceType'];
                    updateSelected(p.id, { priceType: type, unitPrice: Number(type === 'retail' ? p.salePrice : p.wholesalePrice ?? 0) });
                  }} className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                    <option value="retail">Varejo</option><option value="wholesale">Atacado</option>
                  </select>
                </label>
                <label className="col-span-2 text-xs text-gray-500 md:col-span-2">Preço unitário de referência (R$)
                  <input inputMode="decimal" value={moneyInput(item.unitPrice)}
                    onChange={e => updateSelected(p.id, { unitPrice: parseMoney(e.target.value) })}
                    className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-900"/>
                </label>
              </div>
              <div className="mt-3 border-t pt-2 text-right text-sm dark:border-gray-700">
                <span className="text-gray-500">Subtotal de referência: </span>
                <strong>{formatCurrency(item.quantity * item.unitPrice)}</strong>
              </div>
            </div>;
          })}
          <label className="block text-xs text-gray-500">Observação da saída (opcional)
            <input value={batchNote} maxLength={500} onChange={e => setBatchNote(e.target.value)}
              placeholder="Ex.: retirada de material"
              className="mt-1 w-full rounded-lg border p-2 text-sm dark:border-gray-700 dark:bg-gray-900"/>
          </label>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-xs text-gray-500">Total de referência dos itens</p><strong>{formatCurrency(selectedTotal)}</strong><p className="text-xs text-gray-500">Não é venda nem lançamento financeiro.</p></div>
            <button onClick={() => void addItemsToStockOut()} disabled={batchBusy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 font-bold text-white disabled:opacity-50">
              <ArrowUpFromLine size={19}/>{batchBusy ? 'CONFIRMANDO BAIXA...' : 'CONFIRMAR BAIXA DE TODOS'}
            </button>
          </div>
        </div>}
      </section>

      <section className="rounded-xl border dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 dark:border-gray-700">
          <h2 className="font-bold">Produtos cadastrados</h2>
          <div className="flex gap-2">
            <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-900">
              <option value="all">Todos</option><option value="low">Estoque baixo</option><option value="available">Acima do mínimo</option>
            </select>
            <button onClick={() => void reload()} className="rounded-lg border px-3 dark:border-gray-700" title="Atualizar"><RefreshCw size={18}/></button>
          </div>
        </div>
        <div className="max-h-[460px] overflow-auto">
          <table className="w-full min-w-[650px] text-sm">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900"><tr>
              {['Produto','Código','Saldo','Mínimo','Varejo','Atacado','Ações'].map(x => <th key={x} className="p-3 text-left">{x}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map(p => <tr key={p.id} className="border-t dark:border-gray-700">
                <td className="p-3 font-semibold">{p.name}<div className="text-xs text-gray-500">{p.category || p.supplier || ''}</div></td>
                <td className="p-3">{p.sku || '—'}</td>
                <td className={`p-3 font-bold ${p.quantity <= p.minimumQuantity ? 'text-amber-600' : ''}`}>{p.quantity}</td>
                <td className="p-3">{p.minimumQuantity}</td>
                <td className="p-3">{formatCurrency(p.salePrice)}</td>
                <td className="p-3">{formatCurrency(Number(p.wholesalePrice ?? 0))}</td>
                <td className="p-3"><div className="flex gap-1">
                  <button title="Entrada" onClick={() => openMovement(p, 'entry')} className="rounded-lg p-2 text-emerald-600"><ArrowDownToLine size={17}/></button>
                  <button title="Saída" onClick={() => openMovement(p, 'exit')} className="rounded-lg p-2 text-amber-600"><ArrowUpFromLine size={17}/></button>
                  <button title="Editar" onClick={() => setEditing({...p, wholesalePrice: Number(p.wholesalePrice ?? 0), costPrice: Number(p.costPrice ?? 0)})} className="rounded-lg p-2"><Pencil size={17}/></button>
                  <button title="Excluir" onClick={() => void remove(p)} className="rounded-lg p-2 text-red-500"><Trash2 size={17}/></button>
                </div></td>
              </tr>)}
              {!filtered.length && <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhum produto encontrado.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border p-4 dark:border-gray-700">
        <h2 className="mb-3 font-bold">Movimentações recentes</h2>
        {data.movements.slice(0, 10).map(m => {
          const p = data.products.find(x => x.id === m.productId);
          return <div key={m.id} className="flex justify-between gap-3 border-t py-2 text-sm dark:border-gray-700">
            <span>{p?.name || 'Produto'} — {m.note || (m.type === 'entry' ? 'Entrada' : 'Saída')}</span>
            <strong className={m.type === 'entry' ? 'text-emerald-600' : 'text-amber-600'}>{m.type === 'entry' ? '+' : '-'}{m.quantity}</strong>
          </div>;
        })}
        {!data.movements.length && <p className="text-sm text-gray-500">Nenhuma movimentação registrada.</p>}
      </section>

      <p className="text-xs text-gray-500">{synced ? 'Dados sincronizados com a nuvem.' : 'Dados locais ou aguardando sincronização. Confirme a nuvem após a migração SQL.'}</p>

      {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
        <form onSubmit={save} className="max-h-[92vh] w-full max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">{data.products.some(p => p.id === editing.id) ? 'Editar produto' : 'Novo produto'}</h2><button type="button" onClick={() => setEditing(null)}><X/></button></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">Nome do produto<input required maxLength={160} value={editing.name} onChange={e => setEditing({...editing,name:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
            <label className="text-sm">Código / SKU<input value={editing.sku} onChange={e => setEditing({...editing,sku:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
            <label className="text-sm">Categoria<input value={editing.category} onChange={e => setEditing({...editing,category:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
            <label className="text-sm sm:col-span-2">Fornecedor<input value={editing.supplier} onChange={e => setEditing({...editing,supplier:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
            <label className="text-sm">Quantidade inicial<input type="number" min="0" step="1" disabled={data.products.some(p => p.id === editing.id)} value={editing.quantity} onChange={e => setEditing({...editing,quantity:Number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800"/>{data.products.some(p => p.id === editing.id) && <span className="text-xs text-gray-500">Para alterar o saldo, use Entrada ou Saída.</span>}</label>
            <label className="text-sm">Estoque mínimo<input type="number" min="0" step="1" value={editing.minimumQuantity} onChange={e => setEditing({...editing,minimumQuantity:Number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
            <label className="text-sm">Preço de varejo (R$)<input inputMode="decimal" value={moneyInput(editing.salePrice)} onChange={e => setEditing({...editing,salePrice:parseMoney(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
            <label className="text-sm">Preço de atacado (R$)<input inputMode="decimal" value={moneyInput(Number(editing.wholesalePrice ?? 0))} onChange={e => setEditing({...editing,wholesalePrice:parseMoney(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          </div>
          <p className="text-xs text-gray-500">O preço de referência não cria venda nem lançamento financeiro.</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white">Salvar produto</button></div>
        </form>
      </div>}

      {movementProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
        <form onSubmit={move} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 dark:bg-gray-900">
          <h2 className="text-xl font-bold">{movementType === 'entry' ? 'Entrada de estoque' : 'Saída de estoque'}</h2>
          <p>{movementProduct.name} — saldo atual: {movementProduct.quantity}</p>
          <label className="block text-sm">Quantidade<input type="number" min="1" step="1" required value={movementQuantity} onChange={e => setMovementQuantity(e.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="block text-sm">Observação<input maxLength={500} value={movementNote} onChange={e => setMovementNote(e.target.value)} placeholder="Ex.: recebimento, reposição, retirada..." className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setMovementProduct(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-primary-600 px-4 py-2 text-white">Confirmar entrada/saída</button></div>
        </form>
      </div>}

      {entryPicker && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
        <div className="max-h-[85vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-2xl bg-white p-5 dark:bg-gray-900">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">Entrada no estoque</h2><button onClick={() => setEntryPicker(false)}><X/></button></div>
          <p className="text-sm text-gray-500">Selecione o produto que chegou para registrar a quantidade recebida.</p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className="w-full rounded-xl border p-3 dark:border-gray-700 dark:bg-gray-800"/>
          <div className="max-h-[55vh] space-y-2 overflow-y-auto">
            {data.products.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(search.toLowerCase())).map(p => <button key={p.id} onClick={() => openMovement(p, 'entry')} className="flex w-full items-center justify-between rounded-xl border p-3 text-left dark:border-gray-700">
              <span><strong className="block">{p.name}</strong><small className="text-gray-500">{p.sku || 'Sem código'} · saldo {p.quantity}</small></span><ArrowDownToLine className="text-emerald-600"/>
            </button>)}
            {!data.products.length && <p className="text-sm text-gray-500">Cadastre um produto antes de registrar uma entrada.</p>}
          </div>
        </div>
      </div>}

      {tableOpen && <div className="fixed inset-0 z-[60] flex flex-col bg-white p-3 dark:bg-gray-950 md:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-bold">Tabela de produtos</h2><p className="text-xs text-gray-500">Tela ampliada · atalho F12 para abrir ou fechar</p></div>
          <button onClick={() => setTableOpen(false)} className="rounded-xl border p-2 dark:border-gray-700"><X/></button>
        </div>
        <div className="mb-3 flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar na tabela..." className="min-w-0 flex-1 rounded-xl border p-3 dark:border-gray-700 dark:bg-gray-900"/>
          <button onClick={() => setEditing(blankProduct())} className="rounded-xl bg-primary-600 px-4 py-2 font-semibold text-white"><Plus className="inline" size={17}/> Novo</button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto rounded-xl border dark:border-gray-700">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-900"><tr>{['Produto','Código','Categoria','Fornecedor','Saldo','Mínimo','Varejo','Atacado','Ações'].map(x => <th key={x} className="p-3 text-left">{x}</th>)}</tr></thead>
            <tbody>{data.products.filter(p => `${p.name} ${p.sku} ${p.category} ${p.supplier}`.toLowerCase().includes(search.toLowerCase())).map(p => <tr key={p.id} className="border-t dark:border-gray-700">
              <td className="p-3 font-semibold">{p.name}</td><td className="p-3">{p.sku || '—'}</td><td className="p-3">{p.category || '—'}</td><td className="p-3">{p.supplier || '—'}</td>
              <td className="p-3 font-bold">{p.quantity}</td><td className="p-3">{p.minimumQuantity}</td><td className="p-3">{formatCurrency(p.salePrice)}</td><td className="p-3">{formatCurrency(Number(p.wholesalePrice ?? 0))}</td>
              <td className="p-3"><div className="flex gap-1"><button title="Editar" onClick={() => setEditing({...p, wholesalePrice:Number(p.wholesalePrice ?? 0), costPrice:Number(p.costPrice ?? 0)})} className="rounded-lg p-2"><Pencil size={17}/></button><button title="Excluir" onClick={() => void remove(p)} className="rounded-lg p-2 text-red-500"><Trash2 size={17}/></button></div></td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="pt-2 text-xs text-gray-500">{data.products.length} produto(s) cadastrado(s).</p>
      </div>}
    </div>
  );
};

export default Inventory;
