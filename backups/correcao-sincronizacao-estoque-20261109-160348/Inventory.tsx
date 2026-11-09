import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Package, Plus, Search, Trash2, Pencil, RefreshCw } from 'lucide-react';
import { inventoryService } from '../services/inventory';
import type { InventoryProduct, InventoryMovementType, InventoryData } from '../types/inventory';
import { formatCurrency } from '../utils';

const blankProduct = (): InventoryProduct => ({
  id: crypto.randomUUID(), name: '', sku: '', category: '', supplier: '',
  quantity: 0, minimumQuantity: 0, costPrice: 0, salePrice: 0,
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
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<InventoryProduct | null>(null);
  const [movementProduct, setMovementProduct] = useState<InventoryProduct | null>(null);
  const [movementType, setMovementType] = useState<InventoryMovementType>('entry');
  const [movementQuantity, setMovementQuantity] = useState('1');
  const [movementNote, setMovementNote] = useState('');

  const reload = async () => {
    if (!familyId || familyId === 'v1') {
      setMessage('Entre na sua família para acessar o Estoque.');
      setLoading(false);
      return;
    }
    const result = await inventoryService.load(familyId);
    setData(result.data);
    setSynced(result.synced);
    setLoading(false);
  };

  useEffect(() => { void reload(); }, []);

  const filtered = useMemo(() => data.products.filter(p => {
    const term = search.toLowerCase();
    const matches = `${p.name} ${p.sku} ${p.category} ${p.supplier}`.toLowerCase().includes(term);
    const status = filter === 'low' ? p.quantity <= p.minimumQuantity :
      filter === 'available' ? p.quantity > p.minimumQuantity : true;
    return matches && status;
  }), [data.products, search, filter]);

  const totalCost = data.products.reduce((sum, p) => sum + p.quantity * p.costPrice, 0);
  const totalSale = data.products.reduce((sum, p) => sum + p.quantity * p.salePrice, 0);
  const lowCount = data.products.filter(p => p.quantity <= p.minimumQuantity).length;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing || !editing.name.trim()) return;
    if ([editing.costPrice, editing.salePrice].some(v => !Number.isFinite(v) || v < 0)) {
      setMessage('Confira os preços informados.');
      return;
    }
    const result = await inventoryService.saveProduct(familyId, { ...editing, updatedAt: new Date().toISOString() });
    setData(await inventoryService.load(familyId).then(r => r.data));
    setSynced(result.synced);
    setEditing(null);
    setMessage(result.synced ? 'Produto salvo na nuvem.' : 'Produto salvo neste aparelho; sincronização pendente.');
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
      setMessage('Movimentação registrada e confirmada na nuvem.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível registrar a movimentação.');
    }
  };

  const remove = async (product: InventoryProduct) => {
    if (!window.confirm(`Excluir "${product.name}"? O histórico relacionado também será removido.`)) return;
    const result = await inventoryService.deleteProduct(familyId, product.id);
    await reload();
    setMessage(result.synced ? 'Produto excluído.' : 'Exclusão pendente de sincronização.');
  };

  if (loading) return <div className="p-8 text-center">Carregando Estoque...</div>;

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque</h1>
          <p className="text-sm text-gray-500">Controle de produtos, quantidades e movimentações</p>
        </div>
        <button onClick={() => setEditing(blankProduct())} className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-3 font-semibold text-white">
          <Plus size={18} /> Novo produto
        </button>
      </div>

      {message && <div className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 dark:bg-blue-950/30 dark:text-blue-200">{message}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border p-4 dark:border-gray-700"><p className="text-sm text-gray-500">Produtos cadastrados</p><strong className="text-2xl">{data.products.length}</strong></div>
        <div className="rounded-xl border p-4 dark:border-gray-700"><p className="text-sm text-gray-500">Itens abaixo do mínimo</p><strong className="text-2xl text-amber-600">{lowCount}</strong></div>
        <div className="rounded-xl border p-4 dark:border-gray-700"><p className="text-sm text-gray-500">Valor de custo do estoque</p><strong className="text-xl">{formatCurrency(totalCost)}</strong></div>
        <div className="rounded-xl border p-4 dark:border-gray-700"><p className="text-sm text-gray-500">Valor potencial de venda</p><strong className="text-xl text-emerald-600">{formatCurrency(totalSale)}</strong></div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-3 text-gray-400" size={18}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto, código, categoria..." className="w-full rounded-xl border py-2.5 pl-10 pr-3 dark:border-gray-700 dark:bg-gray-900"/></div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-xl border px-3 dark:border-gray-700 dark:bg-gray-900"><option value="all">Todos</option><option value="low">Estoque baixo</option><option value="available">Acima do mínimo</option></select>
        <button onClick={() => void reload()} className="rounded-xl border px-3 dark:border-gray-700" title="Atualizar"><RefreshCw size={18}/></button>
      </div>

      <div className="overflow-x-auto rounded-xl border dark:border-gray-700">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-gray-100 dark:bg-gray-900"><tr>{['Produto','Código','Categoria','Quantidade','Mínimo','Custo','Venda','Ações'].map(x => <th key={x} className="p-3 text-left">{x}</th>)}</tr></thead>
          <tbody>
            {filtered.map(p => <tr key={p.id} className="border-t dark:border-gray-700">
              <td className="p-3 font-semibold">{p.name}{p.quantity <= p.minimumQuantity && <span className="ml-2 inline-flex text-amber-600" title="Estoque baixo"><AlertTriangle size={15}/></span>}<div className="text-xs text-gray-500">{p.supplier}</div></td>
              <td className="p-3">{p.sku || '—'}</td><td className="p-3">{p.category || '—'}</td>
              <td className={`p-3 font-bold ${p.quantity <= p.minimumQuantity ? 'text-amber-600' : ''}`}>{p.quantity}</td>
              <td className="p-3">{p.minimumQuantity}</td><td className="p-3">{formatCurrency(p.costPrice)}</td><td className="p-3">{formatCurrency(p.salePrice)}</td>
              <td className="p-3"><div className="flex gap-1">
                <button title="Entrada" onClick={() => {setMovementProduct(p);setMovementType('entry');}} className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"><ArrowDownToLine size={17}/></button>
                <button title="Saída" onClick={() => {setMovementProduct(p);setMovementType('exit');}} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><ArrowUpFromLine size={17}/></button>
                <button title="Editar" onClick={() => setEditing({...p})} className="rounded-lg p-2"><Pencil size={17}/></button>
                <button title="Excluir" onClick={() => void remove(p)} className="rounded-lg p-2 text-red-500"><Trash2 size={17}/></button>
              </div></td>
            </tr>)}
            {!filtered.length && <tr><td colSpan={8} className="p-8 text-center text-gray-500">Nenhum produto encontrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-4 dark:border-gray-700">
        <h2 className="mb-3 font-bold">Movimentações recentes</h2>
        {data.movements.slice(0, 10).map(m => {
          const p = data.products.find(x => x.id === m.productId);
          return <div key={m.id} className="flex justify-between border-t py-2 text-sm dark:border-gray-700"><span>{p?.name || 'Produto'} — {m.note || (m.type === 'entry' ? 'Entrada' : 'Saída')}</span><strong className={m.type === 'entry' ? 'text-emerald-600' : 'text-amber-600'}>{m.type === 'entry' ? '+' : '-'}{m.quantity}</strong></div>;
        })}
        {!data.movements.length && <p className="text-sm text-gray-500">Nenhuma movimentação registrada.</p>}
      </div>

      <p className="text-xs text-gray-500">{synced ? 'Dados sincronizados com a nuvem.' : 'Exibindo dados locais ou aguardando sincronização. Confirme a nuvem após a migração SQL.'}</p>

      {editing && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"><form onSubmit={save} className="max-h-[90vh] w-full max-w-xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 dark:bg-gray-900">
        <h2 className="text-xl font-bold">{data.products.some(p => p.id === editing.id) ? 'Editar produto' : 'Novo produto'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2 text-sm">Nome do produto<input required maxLength={160} value={editing.name} onChange={e => setEditing({...editing,name:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="text-sm">Código / SKU<input value={editing.sku} onChange={e => setEditing({...editing,sku:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="text-sm">Categoria<input value={editing.category} onChange={e => setEditing({...editing,category:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="sm:col-span-2 text-sm">Fornecedor<input value={editing.supplier} onChange={e => setEditing({...editing,supplier:e.target.value})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="text-sm">Quantidade inicial<input type="number" min="0" step="1" disabled={data.products.some(p => p.id === editing.id)} value={editing.quantity} onChange={e => setEditing({...editing,quantity:Number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-800"/>{data.products.some(p => p.id === editing.id) && <span className="text-xs text-gray-500">Para alterar o saldo, use Entrada ou Saída de estoque.</span>}</label>
          <label className="text-sm">Estoque mínimo<input type="number" min="0" step="1" value={editing.minimumQuantity} onChange={e => setEditing({...editing,minimumQuantity:Number(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="text-sm">Preço de custo (R$)<input inputMode="decimal" value={moneyInput(editing.costPrice)} onChange={e => setEditing({...editing,costPrice:parseMoney(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
          <label className="text-sm">Preço de venda (R$)<input inputMode="decimal" value={moneyInput(editing.salePrice)} onChange={e => setEditing({...editing,salePrice:parseMoney(e.target.value)})} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-primary-600 px-4 py-2 font-semibold text-white">Salvar produto</button></div>
      </form></div>}

      {movementProduct && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3"><form onSubmit={move} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 dark:bg-gray-900">
        <h2 className="text-xl font-bold">{movementType === 'entry' ? 'Entrada de estoque' : 'Saída de estoque'}</h2><p>{movementProduct.name} — saldo atual: {movementProduct.quantity}</p>
        <label className="block text-sm">Quantidade<input type="number" min="1" step="1" required value={movementQuantity} onChange={e => setMovementQuantity(e.target.value)} className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
        <label className="block text-sm">Observação<input maxLength={500} value={movementNote} onChange={e => setMovementNote(e.target.value)} placeholder="Ex.: compra, venda, ajuste..." className="mt-1 w-full rounded-lg border p-2 dark:border-gray-700 dark:bg-gray-800"/></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setMovementProduct(null)} className="rounded-lg border px-4 py-2">Cancelar</button><button className="rounded-lg bg-primary-600 px-4 py-2 text-white">Confirmar movimentação</button></div>
      </form></div>}
    </div>
  );
};

export default Inventory;
