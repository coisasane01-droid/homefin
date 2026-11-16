import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Product,
  AddedItem,
  StockMovement,
  StockWorkspace,
  StockType,
  HomefinFamilyIdentity,
  EstoqueHomefinPageProps,
} from './types';
import { INITIAL_PRODUCTS } from './data/seedProducts';
import { AppHeader } from './components/AppHeader';
import { TerminalPanel } from './components/TerminalPanel';
import { ListaProdutosModal } from './components/ListaProdutosModal';
import { ProductPhotoModal } from './components/ProductPhotoModal';
import { CadastroProdutoModal } from './components/CadastroProdutoModal';
import { FavoritosModal } from './components/FavoritosModal';
import { HistoricoMovimentacaoModal } from './components/HistoricoMovimentacaoModal';
import { MovimentacaoEstoqueSection } from './components/MovimentacaoEstoqueSection';
import { EstoqueCriticoModal } from './components/EstoqueCriticoModal';
import { GerenciarEstoquesModal } from './components/GerenciarEstoquesModal';
import { getSupabaseClient } from './lib/supabaseClient';
import {
  DEFAULT_FAMILIES,
  DEFAULT_SHARED_ESTOQUE_ID,
  loadOrInitializeLocalWorkspaces,
  getVisibleWorkspacesForFamily,
  saveLocalWorkspaces,
  loadLocalActiveFamily,
  saveLocalActiveFamily,
  loadLocalActiveEstoqueId,
  saveLocalActiveEstoqueId,
  loadLocalProducts,
  saveLocalProducts,
  loadLocalAddedItems,
  saveLocalAddedItems,
  loadLocalHistory,
  saveLocalHistory,
  generateShareCode,
  fetchSupabaseWorkspaces,
  createSupabaseWorkspace,
  joinSupabaseWorkspaceByCode,
  fetchSupabaseProducts,
  upsertSupabaseProducts,
  fetchSupabaseMovements,
  insertSupabaseMovements,
} from './services/stockStorageService';
import { CheckCircle2, RefreshCw, X, Users, Lock } from 'lucide-react';
import homefinSqlSchema from './homefin_estoque_schema.sql?raw';

export function EstoqueHomefinPage({
  supabaseClient,
  homefinUserId,
  homefinFamilyId,
  homefinFamilyName,
}: EstoqueHomefinPageProps = {}) {
  const supabase = useMemo(() => getSupabaseClient(supabaseClient), [supabaseClient]);
  const isExternalHomefinInjected = Boolean(homefinFamilyId);

  // Active HOMEFIN family identity (uses props if embedded in HOMEFIN, or local demo switcher if standalone)
  const [demoFamily, setDemoFamily] = useState<HomefinFamilyIdentity>(() =>
    loadLocalActiveFamily()
  );

  const activeFamily: HomefinFamilyIdentity = useMemo(() => {
    if (homefinFamilyId) {
      return {
        userId: homefinUserId || 'usr-homefin',
        familyId: homefinFamilyId,
        familyName: homefinFamilyName || 'Minha Família HOMEFIN',
      };
    }
    return demoFamily;
  }, [homefinFamilyId, homefinUserId, homefinFamilyName, demoFamily]);

  // All local/loaded workspaces
  const [allWorkspaces, setAllWorkspaces] = useState<StockWorkspace[]>(() =>
    loadOrInitializeLocalWorkspaces(activeFamily)
  );

  // Filter workspaces visible to the active family (shared across families OR owned private)
  const visibleWorkspaces = useMemo(
    () => getVisibleWorkspacesForFamily(allWorkspaces, activeFamily.familyId),
    [allWorkspaces, activeFamily.familyId]
  );

  // Selected stock workspace ID
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    const savedId = loadLocalActiveEstoqueId();
    const initialList = loadOrInitializeLocalWorkspaces(activeFamily);
    const visible = getVisibleWorkspacesForFamily(initialList, activeFamily.familyId);
    if (savedId && visible.some((w) => w.id === savedId)) {
      return savedId;
    }
    return visible[0]?.id || DEFAULT_SHARED_ESTOQUE_ID;
  });

  // Ensure activeWorkspaceId is always valid for current family (e.g. after switching family)
  useEffect(() => {
    if (visibleWorkspaces.length === 0) return;
    if (!visibleWorkspaces.some((w) => w.id === activeWorkspaceId)) {
      const nextId = visibleWorkspaces[0].id;
      setActiveWorkspaceId(nextId);
      saveLocalActiveEstoqueId(nextId);
    }
  }, [visibleWorkspaces, activeWorkspaceId]);

  const activeWorkspace = useMemo(
    () =>
      visibleWorkspaces.find((w) => w.id === activeWorkspaceId) ||
      visibleWorkspaces[0] ||
      allWorkspaces[0],
    [visibleWorkspaces, activeWorkspaceId, allWorkspaces]
  );

  // Scoped Products, AddedItems, and Movements for the active workspace
  const [products, setProducts] = useState<Product[]>(() =>
    loadLocalProducts(activeWorkspaceId)
  );
  const [addedItems, setAddedItems] = useState<AddedItem[]>(() =>
    loadLocalAddedItems(activeWorkspaceId)
  );
  const [movements, setMovements] = useState<StockMovement[]>(() =>
    loadLocalHistory(activeWorkspaceId)
  );

  // Modal states
  const [isListaModalOpen, setIsListaModalOpen] = useState(false);
  const [isCadastroModalOpen, setIsCadastroModalOpen] = useState(false);
  const [isFavoritosModalOpen, setIsFavoritosModalOpen] = useState(false);
  const [isHistoricoModalOpen, setIsHistoricoModalOpen] = useState(false);
  const [isEstoqueCriticoOpen, setIsEstoqueCriticoOpen] = useState(false);
  const [isGerenciarEstoquesOpen, setIsGerenciarEstoquesOpen] = useState(false);
  const [activePhotoProduct, setActivePhotoProduct] = useState<Product | null>(null);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [confirmResetPending, setConfirmResetPending] = useState(false);

  // User feedback toast banner
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'warning'>('success');

  const showToast = useCallback(
    (msg: string, type: 'success' | 'info' | 'warning' = 'success') => {
      setToastMessage(msg);
      setToastType(type);
      setTimeout(() => {
        setToastMessage((curr) => (curr === msg ? null : curr));
      }, 4500);
    },
    []
  );

  // Load workspace list from Supabase when connected
  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;

    const loadRemoteWorkspaces = async () => {
      try {
        let remote = await fetchSupabaseWorkspaces(supabase);
        if (remote.length === 0) {
          const sharedWs = await createSupabaseWorkspace(supabase, {
            nome: 'Estoque Compartilhado (Famílias)',
            tipo: 'compartilhado',
            family: activeFamily,
            seedInitialProducts: true,
          });
          const privateWs = await createSupabaseWorkspace(supabase, {
            nome: 'Meu Estoque Separado (Privado)',
            tipo: 'privado',
            family: activeFamily,
            seedInitialProducts: false,
          });
          remote = [sharedWs, privateWs];
        }
        if (!cancelled) {
          setAllWorkspaces(remote);
          saveLocalWorkspaces(remote);
        }
      } catch {
        // Fallback silencioso para modo local caso o schema SQL ainda não tenha sido aplicado no Supabase
      }
    };

    loadRemoteWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [supabase, activeFamily]);

  // Load active workspace data (Local + Supabase + Realtime subscription)
  useEffect(() => {
    if (!activeWorkspaceId) return;
    saveLocalActiveEstoqueId(activeWorkspaceId);

    // Immediate local cache load for zero-flicker switching
    setProducts(loadLocalProducts(activeWorkspaceId));
    setAddedItems(loadLocalAddedItems(activeWorkspaceId));
    setMovements(loadLocalHistory(activeWorkspaceId));

    if (!supabase) return;
    let cancelled = false;

    const loadRemoteData = async () => {
      try {
        const [remoteProducts, remoteMovements] = await Promise.all([
          fetchSupabaseProducts(supabase, activeWorkspaceId),
          fetchSupabaseMovements(supabase, activeWorkspaceId),
        ]);
        if (!cancelled) {
          setProducts(remoteProducts);
          saveLocalProducts(activeWorkspaceId, remoteProducts);
          setMovements(remoteMovements);
          saveLocalHistory(activeWorkspaceId, remoteMovements);
        }
      } catch {
        // Fallback local se tabelas Supabase ainda não existirem
      }
    };

    loadRemoteData();

    // Realtime sync between shared HOMEFIN families
    const channel = supabase
      .channel(`homefin_estoque_${activeWorkspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'homefin_estoque_produtos',
          filter: `estoque_id=eq.${activeWorkspaceId}`,
        },
        () => {
          loadRemoteData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'homefin_estoque_movimentacoes',
          filter: `estoque_id=eq.${activeWorkspaceId}`,
        },
        () => {
          loadRemoteData();
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [activeWorkspaceId, supabase]);

  // Persist local workspaces whenever modified
  useEffect(() => {
    saveLocalWorkspaces(allWorkspaces);
  }, [allWorkspaces]);

  // Persist current workspace products/addedItems/movements locally
  useEffect(() => {
    if (!activeWorkspaceId) return;
    saveLocalProducts(activeWorkspaceId, products);
  }, [activeWorkspaceId, products]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    saveLocalAddedItems(activeWorkspaceId, addedItems);
  }, [activeWorkspaceId, addedItems]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    saveLocalHistory(activeWorkspaceId, movements);
  }, [activeWorkspaceId, movements]);

  // Switch between Shared Family Stock and Separate Private Stock
  const handleSelectWorkspace = useCallback(
    (estoqueId: string) => {
      if (estoqueId === activeWorkspaceId) return;
      const target = visibleWorkspaces.find((w) => w.id === estoqueId);
      setActiveWorkspaceId(estoqueId);
      if (target) {
        showToast(
          `Entrou em: ${target.nome} (${target.tipo === 'compartilhado' ? 'Compartilhado' : 'Privado'})`,
          'info'
        );
      }
    },
    [activeWorkspaceId, visibleWorkspaces, showToast]
  );

  // Create a new Shared or Private Stock
  const handleCreateWorkspace = useCallback(
    async (params: { nome: string; tipo: StockType; seedInitialProducts: boolean }) => {
      const { nome, tipo, seedInitialProducts } = params;

      if (supabase) {
        try {
          const created = await createSupabaseWorkspace(supabase, {
            nome,
            tipo,
            family: activeFamily,
            seedInitialProducts,
          });
          setAllWorkspaces((prev) => [...prev, created]);
          setActiveWorkspaceId(created.id);
          showToast(
            `Estoque "${created.nome}" criado no Supabase!`,
            'success'
          );
          return;
        } catch {
          // fallback para criação local caso Supabase ainda esteja sem schema
        }
      }

      const newId = `est-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const now = new Date().toISOString();
      const newWorkspace: StockWorkspace = {
        id: newId,
        nome,
        tipo,
        ownerFamilyId: activeFamily.familyId,
        ownerFamilyName: activeFamily.familyName,
        codigoCompartilhamento: tipo === 'compartilhado' ? generateShareCode() : undefined,
        membros: [
          {
            familyId: activeFamily.familyId,
            familyName: activeFamily.familyName,
            role: 'dono',
            joinedAt: now,
          },
        ],
        createdAt: now,
      };

      const initialProds: Product[] = seedInitialProducts
        ? INITIAL_PRODUCTS.map((p) => ({ ...p, id: `${newId}-${p.id}`, estoqueId: newId }))
        : [];

      saveLocalProducts(newId, initialProds);
      saveLocalAddedItems(newId, []);
      saveLocalHistory(newId, []);

      setAllWorkspaces((prev) => [...prev, newWorkspace]);
      setActiveWorkspaceId(newId);
      showToast(
        tipo === 'compartilhado'
          ? `Estoque compartilhado "${nome}" criado! Código: ${newWorkspace.codigoCompartilhamento}`
          : `Estoque privado "${nome}" criado (sem compartilhamento).`,
        'success'
      );
    },
    [supabase, activeFamily, showToast]
  );

  // Join another HOMEFIN family's shared stock via code
  const handleJoinByCode = useCallback(
    async (codigo: string): Promise<{ ok: boolean; message: string }> => {
      const normalized = codigo.trim().toUpperCase();
      if (!normalized) {
        return { ok: false, message: 'Informe um código de compartilhamento válido.' };
      }

      if (supabase) {
        try {
          const joined = await joinSupabaseWorkspaceByCode(supabase, normalized, activeFamily);
          setAllWorkspaces((prev) => {
            const exists = prev.some((w) => w.id === joined.id);
            return exists
              ? prev.map((w) => (w.id === joined.id ? joined : w))
              : [...prev, joined];
          });
          setActiveWorkspaceId(joined.id);
          showToast(`Vinculado ao estoque compartilhado "${joined.nome}"!`, 'success');
          return { ok: true, message: `Entrou no estoque "${joined.nome}"!` };
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Código não encontrado no Supabase.';
          return { ok: false, message: msg };
        }
      }

      const target = allWorkspaces.find(
        (w) =>
          w.tipo === 'compartilhado' &&
          w.codigoCompartilhamento?.toUpperCase() === normalized
      );

      if (!target) {
        return {
          ok: false,
          message: 'Código não encontrado ou pertence a um estoque privado.',
        };
      }

      const alreadyMember = target.membros.some(
        (m) => m.familyId === activeFamily.familyId
      );

      if (!alreadyMember) {
        const updatedTarget: StockWorkspace = {
          ...target,
          membros: [
            ...target.membros,
            {
              familyId: activeFamily.familyId,
              familyName: activeFamily.familyName,
              role: 'editor',
              joinedAt: new Date().toISOString(),
            },
          ],
        };
        setAllWorkspaces((prev) =>
          prev.map((w) => (w.id === target.id ? updatedTarget : w))
        );
      }

      setActiveWorkspaceId(target.id);
      showToast(`Agora sua família compartilha o estoque "${target.nome}"!`, 'success');
      return { ok: true, message: `Estoque "${target.nome}" vinculado com sucesso!` };
    },
    [supabase, activeFamily, allWorkspaces, showToast]
  );

  // Delete owned workspace
  const handleDeleteWorkspace = useCallback(
    (estoqueId: string) => {
      setAllWorkspaces((prev) => prev.filter((w) => w.id !== estoqueId));
      showToast('Estoque removido.', 'info');
    },
    [showToast]
  );

  // Switch active demo family (standalone preview testing)
  const handleSwitchDemoFamily = useCallback(
    (fam: HomefinFamilyIdentity) => {
      setDemoFamily(fam);
      saveLocalActiveFamily(fam);
      showToast(`Visualizando HOMEFIN como: ${fam.familyName}`, 'info');
    },
    [showToast]
  );

  const handleCopySqlSchema = useCallback(() => {
    navigator.clipboard.writeText(homefinSqlSchema);
    showToast('Script SQL (homefin_estoque_schema.sql) copiado!', 'success');
  }, [showToast]);

  // Update sales velocity rate of a product
  const handleUpdateProductSalesRate = useCallback(
    (productId: string, newRate: number) => {
      setProducts((prev) => {
        const updated = prev.map((p) =>
          p.id === productId ? { ...p, vendaMediaMensal: newRate } : p
        );
        const target = updated.find((p) => p.id === productId);
        if (supabase && target && activeWorkspaceId) {
          upsertSupabaseProducts(supabase, activeWorkspaceId, [target]).catch(() => {});
        }
        return updated;
      });
    },
    [supabase, activeWorkspaceId]
  );

  // Global Keyboard shortcuts: F12 (Lista de Produtos), F11 (Favoritos), F10 (Cadastrar)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        e.preventDefault();
        setIsListaModalOpen((prev) => !prev);
      } else if (e.key === 'F11') {
        e.preventDefault();
        setIsFavoritosModalOpen((prev) => !prev);
      } else if (e.key === 'F10') {
        e.preventDefault();
        setProductToEdit(null);
        setIsCadastroModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Operation: Add item to the queue
  const handleAddItemToQueue = useCallback(
    (param: {
      product: Product;
      quantity: number;
      price: number;
      tipoPreco: 'varejo' | 'atacado';
      desconto: number;
      tipoDesconto: 'valor' | 'porcentagem';
      valorTotal: number;
    }) => {
      const { product, quantity, price, tipoPreco, desconto, tipoDesconto, valorTotal } = param;

      const newItem: AddedItem = {
        id: `added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        estoqueId: activeWorkspaceId,
        productId: product.id,
        codigoInterno: product.codigoInterno,
        codigoBarras: product.codigoBarras,
        descricao: product.descricao,
        medida: product.medida,
        marcaRefer: product.marcaRefer,
        unidade: product.unidade,
        estoqueAtual: product.estoqueAtual,
        qtdAdicionado: quantity,
        tipoPreco,
        precoUnitario: price,
        desconto,
        tipoDesconto,
        valorTotal,
        fotoUrl: product.fotoUrl,
      };

      setAddedItems((prev) => [newItem, ...prev]);
      showToast(`Adicionado: ${product.descricao} (${quantity} ${product.unidade})`, 'info');
    },
    [activeWorkspaceId, showToast]
  );

  // Add product from F12 table (+)
  const handleAddProductFromTable = useCallback(
    (product: Product) => {
      const newItem: AddedItem = {
        id: `added-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        estoqueId: activeWorkspaceId,
        productId: product.id,
        codigoInterno: product.codigoInterno,
        codigoBarras: product.codigoBarras,
        descricao: product.descricao,
        medida: product.medida,
        marcaRefer: product.marcaRefer,
        unidade: product.unidade,
        estoqueAtual: product.estoqueAtual,
        qtdAdicionado: 1,
        tipoPreco: 'varejo',
        precoUnitario: product.precoVarejo,
        desconto: 0,
        tipoDesconto: 'valor',
        valorTotal: product.precoVarejo,
        fotoUrl: product.fotoUrl,
      };
      setAddedItems((prev) => [...prev, newItem]);
      showToast(`+1 ${product.descricao} adicionado à conferência!`, 'info');
    },
    [activeWorkspaceId, showToast]
  );

  const handleRemoveAddedItem = useCallback((id: string) => {
    setAddedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleUpdateItemQuantity = useCallback((id: string, newQtd: number) => {
    setAddedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const subtotal = newQtd * item.precoUnitario;
          const total =
            item.tipoDesconto === 'valor'
              ? Math.max(0, subtotal - item.desconto)
              : Math.max(0, subtotal * (1 - item.desconto / 100));
          return {
            ...item,
            qtdAdicionado: newQtd,
            valorTotal: total,
          };
        }
        return item;
      })
    );
  }, []);

  const handleClearAddedItems = useCallback(() => {
    setAddedItems([]);
    showToast('Lista de conferência limpa.', 'info');
  }, [showToast]);

  // Quick Baixa on single item
  const handleQuickBaixa = useCallback(
    (product: Product, quantity: number) => {
      const prevEstoque = product.estoqueAtual;
      const newEstoque = prevEstoque - quantity;
      const updatedProd = { ...product, estoqueAtual: newEstoque };

      setProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProd : p)));
      setAddedItems((prev) =>
        prev.map((item) =>
          item.productId === product.id ? { ...item, estoqueAtual: newEstoque } : item
        )
      );

      const movement: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        estoqueId: activeWorkspaceId,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        productId: product.id,
        codigoInterno: product.codigoInterno,
        descricao: product.descricao,
        tipo: 'baixa',
        quantidade: quantity,
        estoqueAnterior: prevEstoque,
        estoqueNovo: newEstoque,
        familiaNome: activeFamily.familyName,
      };
      setMovements((prev) => [movement, ...prev]);

      if (supabase && activeWorkspaceId) {
        upsertSupabaseProducts(supabase, activeWorkspaceId, [updatedProd]).catch(() => {});
        insertSupabaseMovements(supabase, activeWorkspaceId, [movement]).catch(() => {});
      }

      showToast(
        `BAIXA realizada: -${quantity} ${product.unidade} de "${product.descricao}". Novo estoque: ${newEstoque.toFixed(0)}`,
        'success'
      );
    },
    [activeWorkspaceId, activeFamily.familyName, supabase, showToast]
  );

  // Quick Entrada on single item
  const handleQuickEntrada = useCallback(
    (product: Product, quantity: number) => {
      const prevEstoque = product.estoqueAtual;
      const newEstoque = prevEstoque + quantity;
      const updatedProd = { ...product, estoqueAtual: newEstoque };

      setProducts((prev) => prev.map((p) => (p.id === product.id ? updatedProd : p)));
      setAddedItems((prev) =>
        prev.map((item) =>
          item.productId === product.id ? { ...item, estoqueAtual: newEstoque } : item
        )
      );

      const movement: StockMovement = {
        id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        estoqueId: activeWorkspaceId,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        productId: product.id,
        codigoInterno: product.codigoInterno,
        descricao: product.descricao,
        tipo: 'entrada',
        quantidade: quantity,
        estoqueAnterior: prevEstoque,
        estoqueNovo: newEstoque,
        familiaNome: activeFamily.familyName,
      };
      setMovements((prev) => [movement, ...prev]);

      if (supabase && activeWorkspaceId) {
        upsertSupabaseProducts(supabase, activeWorkspaceId, [updatedProd]).catch(() => {});
        insertSupabaseMovements(supabase, activeWorkspaceId, [movement]).catch(() => {});
      }

      showToast(
        `ENTRADA realizada: +${quantity} ${product.unidade} em "${product.descricao}". Novo estoque: ${newEstoque.toFixed(0)}`,
        'success'
      );
    },
    [activeWorkspaceId, activeFamily.familyName, supabase, showToast]
  );

  // Batch Baixa on all items in queue (Confirmar F2)
  const handleConfirmBaixaAll = useCallback(() => {
    if (addedItems.length === 0) return;

    const newMovements: StockMovement[] = [];
    const touchedProducts: Product[] = [];
    const updatedProducts = [...products];

    addedItems.forEach((item) => {
      const idx = updatedProducts.findIndex((p) => p.id === item.productId);
      if (idx !== -1) {
        const prod = updatedProducts[idx];
        const prevEstoque = prod.estoqueAtual;
        const newEstoque = prevEstoque - item.qtdAdicionado;
        const nextProd = { ...prod, estoqueAtual: newEstoque };

        updatedProducts[idx] = nextProd;
        touchedProducts.push(nextProd);

        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          estoqueId: activeWorkspaceId,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          productId: prod.id,
          codigoInterno: prod.codigoInterno,
          descricao: prod.descricao,
          tipo: 'baixa',
          quantidade: item.qtdAdicionado,
          estoqueAnterior: prevEstoque,
          estoqueNovo: newEstoque,
          familiaNome: activeFamily.familyName,
        });
      }
    });

    setProducts(updatedProducts);
    setMovements((prev) => [...newMovements, ...prev]);

    if (supabase && activeWorkspaceId) {
      upsertSupabaseProducts(supabase, activeWorkspaceId, touchedProducts).catch(() => {});
      insertSupabaseMovements(supabase, activeWorkspaceId, newMovements).catch(() => {});
    }

    showToast(`Baixa concluída com sucesso em ${addedItems.length} itens do estoque!`, 'success');
    setAddedItems([]);
    setIsListaModalOpen(false);
  }, [addedItems, products, activeWorkspaceId, activeFamily.familyName, supabase, showToast]);

  // Batch Entrada on all items in queue
  const handleConfirmEntradaAll = useCallback(() => {
    if (addedItems.length === 0) return;

    const newMovements: StockMovement[] = [];
    const touchedProducts: Product[] = [];
    const updatedProducts = [...products];

    addedItems.forEach((item) => {
      const idx = updatedProducts.findIndex((p) => p.id === item.productId);
      if (idx !== -1) {
        const prod = updatedProducts[idx];
        const prevEstoque = prod.estoqueAtual;
        const newEstoque = prevEstoque + item.qtdAdicionado;
        const nextProd = { ...prod, estoqueAtual: newEstoque };

        updatedProducts[idx] = nextProd;
        touchedProducts.push(nextProd);

        newMovements.push({
          id: `mov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          estoqueId: activeWorkspaceId,
          timestamp: new Date().toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          }),
          productId: prod.id,
          codigoInterno: prod.codigoInterno,
          descricao: prod.descricao,
          tipo: 'entrada',
          quantidade: item.qtdAdicionado,
          estoqueAnterior: prevEstoque,
          estoqueNovo: newEstoque,
          familiaNome: activeFamily.familyName,
        });
      }
    });

    setProducts(updatedProducts);
    setMovements((prev) => [...newMovements, ...prev]);

    if (supabase && activeWorkspaceId) {
      upsertSupabaseProducts(supabase, activeWorkspaceId, touchedProducts).catch(() => {});
      insertSupabaseMovements(supabase, activeWorkspaceId, newMovements).catch(() => {});
    }

    showToast(
      `Entrada de mercadoria concluída em ${addedItems.length} itens do estoque!`,
      'success'
    );
    setAddedItems([]);
    setIsListaModalOpen(false);
  }, [addedItems, products, activeWorkspaceId, activeFamily.familyName, supabase, showToast]);

  // Save new or edited product
  const handleSaveProduct = useCallback(
    (savedProd: Product) => {
      const scopedProd: Product = { ...savedProd, estoqueId: activeWorkspaceId };
      setProducts((prev) => {
        const exists = prev.some((p) => p.id === scopedProd.id);
        if (exists) {
          return prev.map((p) => (p.id === scopedProd.id ? scopedProd : p));
        }
        return [scopedProd, ...prev];
      });

      if (supabase && activeWorkspaceId) {
        upsertSupabaseProducts(supabase, activeWorkspaceId, [scopedProd]).catch(() => {});
      }

      showToast(
        `Produto "${scopedProd.descricao}" salvo no estoque "${activeWorkspace?.nome}"!`,
        'success'
      );
    },
    [activeWorkspaceId, activeWorkspace?.nome, supabase, showToast]
  );

  // Reset current stock catalog without window.confirm
  const handleResetCatalog = () => {
    if (!confirmResetPending) {
      setConfirmResetPending(true);
      setTimeout(() => setConfirmResetPending(false), 4000);
      return;
    }
    const resetProds = INITIAL_PRODUCTS.map((p) => ({
      ...p,
      id: `${activeWorkspaceId}-${p.id}`,
      estoqueId: activeWorkspaceId,
    }));
    setProducts(resetProds);
    saveLocalProducts(activeWorkspaceId, resetProds);
    if (supabase && activeWorkspaceId) {
      upsertSupabaseProducts(supabase, activeWorkspaceId, resetProds).catch(() => {});
    }
    setConfirmResetPending(false);
    showToast(`Catálogo de "${activeWorkspace?.nome}" restaurado com sucesso.`, 'info');
  };

  const movementSection = (
    <MovimentacaoEstoqueSection
      products={products}
      addedItems={addedItems}
      onRemoveItem={handleRemoveAddedItem}
      onUpdateItemQuantity={handleUpdateItemQuantity}
      onClearAddedItems={handleClearAddedItems}
      onConfirmBaixaAll={handleConfirmBaixaAll}
      onConfirmEntradaAll={handleConfirmEntradaAll}
      onQuickBaixa={handleQuickBaixa}
      onQuickEntrada={handleQuickEntrada}
      onOpenPhoto={(prod) => setActivePhotoProduct(prod)}
      onOpenCadastro={() => {
        setProductToEdit(null);
        setIsCadastroModalOpen(true);
      }}
      onOpenListaProdutos={() => setIsListaModalOpen(true)}
      onOpenHistorico={() => setIsHistoricoModalOpen(true)}
      onOpenEstoqueCritico={() => setIsEstoqueCriticoOpen(true)}
    />
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#cfd6dc] text-slate-900 selection:bg-emerald-800 selection:text-white">
      {/* Top Header - NO LOGO + 1-Click Shared/Private Stock Switcher */}
      <AppHeader
        onOpenListaProdutos={() => setIsListaModalOpen(true)}
        onOpenCadastro={() => {
          setProductToEdit(null);
          setIsCadastroModalOpen(true);
        }}
        onOpenFavoritos={() => setIsFavoritosModalOpen(true)}
        onOpenHistorico={() => setIsHistoricoModalOpen(true)}
        onOpenGerenciarEstoques={() => setIsGerenciarEstoquesOpen(true)}
        totalProductsCount={products.length}
        workspaces={visibleWorkspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={handleSelectWorkspace}
      />

      {/* Active Workspace Context Banner */}
      <div className="bg-slate-200 border-b border-slate-300 px-3 sm:px-5 py-1.5 text-[11px] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap text-slate-700">
          {activeWorkspace?.tipo === 'compartilhado' ? (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase font-condensed">
              <Users size={12} />
              <span>Estoque Compartilhado HOMEFIN</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-slate-300 text-slate-800 border border-slate-400 px-2 py-0.5 rounded font-bold uppercase font-condensed">
              <Lock size={12} />
              <span>Estoque Separado Privado</span>
            </span>
          )}
          <span>
            Família atual: <strong>{activeFamily.familyName}</strong>
          </span>
          {activeWorkspace?.tipo === 'compartilhado' && (
            <span className="text-slate-600">
              • Visível para:{' '}
              <strong>
                {activeWorkspace.membros.map((m) => m.familyName).join(' e ')}
              </strong>
              {activeWorkspace.codigoCompartilhamento && (
                <>
                  {' '}
                  • Código:{' '}
                  <strong className="font-mono text-[#003816]">
                    {activeWorkspace.codigoCompartilhamento}
                  </strong>
                </>
              )}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsGerenciarEstoquesOpen(true)}
          className="text-[#003816] hover:underline font-bold font-condensed uppercase"
        >
          Alternar família / Código / Integração Supabase
        </button>
      </div>

      {/* User Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`text-white px-4 py-2 text-xs md:text-sm font-semibold flex items-center justify-between border-b shadow-md animate-in slide-in-from-top-2 duration-150 ${
            toastType === 'warning'
              ? 'bg-amber-700 border-amber-900'
              : toastType === 'info'
              ? 'bg-[#004d20] border-emerald-950'
              : 'bg-[#003816] border-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <CheckCircle2 size={16} className="text-[#00c853] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-emerald-200 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-[1720px] w-full mx-auto p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-start">
        {/* LEFT COLUMN: Terminal Panel (contains mobileSlot directly under Dar Entrada button) */}
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-3">
          <TerminalPanel
            products={products}
            onOpenListaProdutos={() => setIsListaModalOpen(true)}
            onOpenFavoritos={() => setIsFavoritosModalOpen(true)}
            onOpenPhoto={(prod) => setActivePhotoProduct(prod)}
            onAddItemToQueue={handleAddItemToQueue}
            onQuickBaixa={handleQuickBaixa}
            onQuickEntrada={handleQuickEntrada}
            mobileSlot={movementSection}
          />

          {/* Quick shortcuts helper strip */}
          <div className="mt-2 bg-slate-200/90 border border-slate-300 rounded p-2 text-[11px] text-slate-600 flex items-center justify-between font-condensed gap-2">
            <span>
              Atalhos: <strong>F12</strong> Tabela | <strong>F11</strong> Favoritos |{' '}
              <strong>F10</strong> Cadastrar | <strong>ENTER</strong> Baixa
            </span>
            <button
              type="button"
              onClick={handleResetCatalog}
              className={`underline flex items-center gap-1 shrink-0 ${
                confirmResetPending
                  ? 'text-rose-700 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Restaurar dados iniciais neste estoque"
            >
              <RefreshCw size={11} />
              <span>{confirmResetPending ? 'Clique novamente p/ confirmar' : 'Resetar catálogo'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN (DESKTOP ONLY): Active Movement Queue & Quick Actions */}
        <div className="hidden lg:flex lg:col-span-7 xl:col-span-8 flex-col space-y-3">
          {movementSection}
        </div>
      </main>

      {/* MODAL 1: LISTA DE PRODUTOS (F12) */}
      <ListaProdutosModal
        isOpen={isListaModalOpen}
        onClose={() => setIsListaModalOpen(false)}
        products={products}
        addedItems={addedItems}
        onAddItem={handleAddProductFromTable}
        onRemoveItem={handleRemoveAddedItem}
        onUpdateItemQuantity={handleUpdateItemQuantity}
        onConfirmBaixaAll={handleConfirmBaixaAll}
        onConfirmEntradaAll={handleConfirmEntradaAll}
        onOpenPhoto={(p) => setActivePhotoProduct(p)}
        onQuickBaixaItem={handleQuickBaixa}
        onQuickEntradaItem={handleQuickEntrada}
      />

      {/* MODAL 3: Cadastro de Produto */}
      {isCadastroModalOpen && (
        <CadastroProdutoModal
          onClose={() => setIsCadastroModalOpen(false)}
          onSaveProduct={handleSaveProduct}
          productToEdit={productToEdit}
          nextCodigoInterno={String(
            Math.max(...products.map((p) => parseInt(p.codigoInterno) || 0), 800) + 1
          )}
        />
      )}

      {/* MODAL 4: Produtos Favoritos (F11) */}
      <FavoritosModal
        isOpen={isFavoritosModalOpen}
        onClose={() => setIsFavoritosModalOpen(false)}
        products={products}
        onSelectProduct={(p) => handleAddProductFromTable(p)}
        onOpenPhoto={(p) => setActivePhotoProduct(p)}
      />

      {/* MODAL 5: Histórico de Movimentações */}
      <HistoricoMovimentacaoModal
        isOpen={isHistoricoModalOpen}
        onClose={() => setIsHistoricoModalOpen(false)}
        movements={movements}
        onClearHistory={() => setMovements([])}
        estoqueNome={activeWorkspace?.nome}
      />

      {/* MODAL 6: Estoque Crítico, Zerados & Alerta de Ruptura / Giro */}
      <EstoqueCriticoModal
        isOpen={isEstoqueCriticoOpen}
        onClose={() => setIsEstoqueCriticoOpen(false)}
        products={products}
        onOpenPhoto={(prod) => setActivePhotoProduct(prod)}
        onQuickEntrada={handleQuickEntrada}
        onAddItemToQueue={(prod, qtd) => {
          handleAddItemToQueue({
            product: prod,
            quantity: qtd,
            price: prod.precoVarejo,
            tipoPreco: 'varejo',
            desconto: 0,
            tipoDesconto: 'valor',
            valorTotal: qtd * prod.precoVarejo,
          });
          setIsEstoqueCriticoOpen(false);
        }}
        onUpdateProductSalesRate={handleUpdateProductSalesRate}
      />

      {/* MODAL 7: Gerenciar Estoques, Compartilhamento entre Famílias & Integração HOMEFIN */}
      <GerenciarEstoquesModal
        isOpen={isGerenciarEstoquesOpen}
        onClose={() => setIsGerenciarEstoquesOpen(false)}
        workspaces={visibleWorkspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeFamily={activeFamily}
        isSupabaseConnected={Boolean(supabase)}
        isExternalHomefinInjected={isExternalHomefinInjected}
        onSelectWorkspace={handleSelectWorkspace}
        onCreateWorkspace={handleCreateWorkspace}
        onJoinByCode={handleJoinByCode}
        onDeleteWorkspace={handleDeleteWorkspace}
        onSwitchDemoFamily={handleSwitchDemoFamily}
        onCopySqlSchema={handleCopySqlSchema}
      />

      {/* MODAL 2: Product Photo Preview & WhatsApp Sharing (Rendered on top of all modals) */}
      <ProductPhotoModal
        product={activePhotoProduct}
        onClose={() => setActivePhotoProduct(null)}
        onEditProduct={(prod) => {
          setProductToEdit(prod);
          setIsCadastroModalOpen(true);
        }}
      />
    </div>
  );
}

export default EstoqueHomefinPage;
