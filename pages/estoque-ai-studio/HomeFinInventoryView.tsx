import { homefinApiUrl } from '../../services/nativeApi';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { inventoryService } from '../../services/inventory';
import { getFamilySessionToken } from '../../services/familyAuth';
import { InventoryConflictsPanel } from './components/InventoryConflictsPanel';
import type { InventoryProduct } from '../../types/inventory';
import type { Product, AddedItem, StockWorkspace } from './types';
import { toAIStudioProduct, toHomeFinProduct } from './services/homefinAdapter';
import { ListaProdutosModal } from './components/ListaProdutosModal';
import { FavoritosModal } from './components/FavoritosModal';
import { CadastroProdutoModal } from './components/CadastroProdutoModal';
import { AppHeader } from './components/AppHeader';
import { CompartilharEstoqueHomeFinModal } from './components/CompartilharEstoqueHomeFinModal';
import { TerminalPanel } from './components/TerminalPanel';
import { ProductPhotoModal } from './components/ProductPhotoModal';
import { MovimentacaoEstoqueSection } from './components/MovimentacaoEstoqueSection';

export default function HomeFinInventoryView() {
  const familyId = localStorage.getItem('homefin_current_family_id') || '';
  const [products, setProducts] = useState<Product[]>([]);
  const [archivedProducts, setArchivedProducts] = useState<Product[]>([]);
  const [sourceProducts, setSourceProducts] =
    useState<InventoryProduct[]>([]);
  const [addedItems, setAddedItems] = useState<AddedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isListaModalOpen, setIsListaModalOpen] = useState(false);
  const [isFavoritosOpen, setIsFavoritosOpen] = useState(false);
  const [favoriteBusyId, setFavoriteBusyId] = useState<string | null>(null);
  const favoriteBusyRef = useRef(false);

  const [isCadastroOpen, setIsCadastroOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isCompartilharOpen, setIsCompartilharOpen] = useState(false);
  const [activePhotoProduct, setActivePhotoProduct] = useState<Product | null>(null);
  const [processing, setProcessing] = useState(false);
  const processingRef = useRef(false);
  const [message, setMessage] = useState('');

  const workspace = useMemo<StockWorkspace>(() => ({
    id: familyId,
    nome: 'Estoque HomeFin',
    tipo: 'privado',
    ownerFamilyId: familyId,
    ownerFamilyName: 'Família HomeFin',
    membros: [],
    createdAt: new Date(0).toISOString(),
  }), [familyId]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        if (!familyId || familyId === 'v1') {
          throw new Error('Entre na sua família para acessar o Estoque.');
        }

        const result = await inventoryService.load(familyId);

        if (!cancelled) {
          setSourceProducts(result.data.products);
          setProducts(result.data.products.filter(p => !p.archivedAt).map(toAIStudioProduct));
          setArchivedProducts(result.data.products.filter(p => Boolean(p.archivedAt)).map(toAIStudioProduct));
          setMessage(result.error || '');
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error
            ? error.message
            : 'Não foi possível carregar o Estoque.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [familyId]);

  // Recupera fotos privadas por URLs temporárias.
  useEffect(() => {
    if (!familyId || familyId === 'v1') return;

    const photoProducts = sourceProducts.filter(
      product => Boolean(product.photoStoragePath)
    );

    if (!photoProducts.length) return;

    let cancelled = false;

    async function loadPhotos() {
      const token = await getFamilySessionToken(familyId);

      if (!token) return;

      const results = await Promise.allSettled(
        photoProducts.map(async product => {
          const response = await fetch(homefinApiUrl('/api/inventory-photo'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: 'view',
              familyId,
              productId: product.id,
            }),
          });

          if (!response.ok) {
            throw new Error('Falha ao carregar foto.');
          }

          const data = await response.json();

          return {
            id: product.id,
            photoUrl: data.photoUrl as string | null,
          };
        })
      );

      if (cancelled) return;

      const photos = new Map<string, string>();

      for (const result of results) {
        if (
          result.status === 'fulfilled' &&
          result.value.photoUrl
        ) {
          photos.set(result.value.id, result.value.photoUrl);
        }
      }

      setProducts(current => current.map(product => ({
        ...product,
        fotoUrl: photos.get(product.id) || product.fotoUrl,
      })));
    }

    void loadPhotos();

    return () => {
      cancelled = true;
    };
  }, [familyId, sourceProducts]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'F11') return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      event.preventDefault();
      setIsFavoritosOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const toggleFavorite = async (product: Product) => {
    if (favoriteBusyRef.current || processingRef.current) return;

    const source = sourceProducts.find(item => item.id === product.id);
    if (!source) {
      setMessage('Produto não encontrado no estoque autorizado.');
      return;
    }

    favoriteBusyRef.current = true;
    setFavoriteBusyId(product.id);

    try {
      const updated = await inventoryService.setFavorite(
        familyId,
        source.id,
        !Boolean(source.favorite),
        source.updatedAt
      );

      setSourceProducts(current =>
        current.map(item => item.id === updated.id ? updated : item)
      );

      setProducts(current =>
        current.map(item => item.id === updated.id
          ? {
              ...item,
              favorito: Boolean(updated.favorite),
            }
          : item
        )
      );

      setMessage(
        updated.favorite
          ? 'Produto adicionado aos favoritos.'
          : 'Produto removido dos favoritos.'
      );
    } catch (error) {
      setMessage(error instanceof Error
        ? error.message
        : 'Não foi possível atualizar o favorito.');
    } finally {
      favoriteBusyRef.current = false;
      setFavoriteBusyId(null);
    }
  };

  const addToQueue = (params: {
    product: Product;
    quantity: number;
    price: number;
    tipoPreco: 'varejo' | 'atacado';
    desconto: number;
    tipoDesconto: 'valor' | 'porcentagem';
    valorTotal: number;
  }) => {
    const { product, quantity, price, tipoPreco,
      desconto, tipoDesconto, valorTotal } = params;

    if (processingRef.current) return;

    const source = sourceProducts.find(p => p.id === product.id);

    if (!source) {
      setMessage('Produto não encontrado no estoque autorizado.');
      return;
    }

    const scaled = Math.round(quantity * 1000);

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      Math.abs(quantity * 1000 - scaled) > 0.000001 ||
      (source.quantityMode !== 'decimal' && !Number.isInteger(quantity))
    ) {
      setMessage('Quantidade inválida para a unidade deste produto.');
      return;
    }

    const alreadyQueued = addedItems
      .filter(item => item.productId === product.id)
      .reduce((sum, item) => sum + item.qtdAdicionado, 0);

    if (Math.round((alreadyQueued + quantity) * 1000) >
        Math.round(source.quantity * 1000)) {
      setMessage('Quantidade superior ao saldo disponível.');
      return;
    }

    setMessage('');
    setAddedItems(prev => [...prev, {
      id: crypto.randomUUID(),
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
    }]);
  };

  const confirmBaixaAll = async () => {
    if (processingRef.current) return;

    if (!addedItems.length) {
      setMessage('Adicione pelo menos um produto à conferência.');
      return;
    }

    const aggregated = new Map<string, number>();

    for (const item of addedItems) {
      const current = aggregated.get(item.productId) || 0;
      aggregated.set(
        item.productId,
        Math.round((current + item.qtdAdicionado) * 1000) / 1000
      );
    }

    const items = Array.from(aggregated, ([productId, quantity]) => ({
      productId,
      quantity,
    }));

    for (const item of items) {
      const source = sourceProducts.find(p => p.id === item.productId);
      const scaled = Math.round(item.quantity * 1000);

      if (
        !source ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        Math.abs(item.quantity * 1000 - scaled) > 0.000001 ||
        (source.quantityMode !== 'decimal' &&
          !Number.isInteger(item.quantity)) ||
        scaled > Math.round(source.quantity * 1000)
      ) {
        setMessage('Revise as quantidades da fila antes de confirmar.');
        return;
      }
    }

    if (items.length > 100) {
      setMessage('A baixa permite até 100 produtos diferentes por operação.');
      return;
    }

    const confirmed = window.confirm(
      `Confirmar a baixa de ${items.length} produto(s) do estoque?`
    );

    if (!confirmed) return;

    processingRef.current = true;
    setProcessing(true);
    setMessage('');

    try {
      await inventoryService.moveBatch(
        familyId,
        items,
        'Baixa confirmada pela conferência AI Studio'
      );

      const result = await inventoryService.load(familyId);

      setSourceProducts(result.data.products);
      setProducts(result.data.products.filter(p => !p.archivedAt).map(toAIStudioProduct));
          setArchivedProducts(result.data.products.filter(p => Boolean(p.archivedAt)).map(toAIStudioProduct));

      setAddedItems([]);
      setMessage('Baixa realizada com sucesso.');
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a baixa.'
      );
    } finally {
      processingRef.current = false;
      setProcessing(false);
    }
  };

  const addProductFromTable = (product: Product) => {
    addToQueue({
      product,
      quantity: 1,
      price: product.precoVarejo,
      tipoPreco: 'varejo',
      desconto: 0,
      tipoDesconto: 'valor',
      valorTotal: product.precoVarejo,
    });
  };

  const blocked = () => {
    setMessage('Movimentações temporariamente bloqueadas durante a integração.');
  };

  const movementSection = (
    <MovimentacaoEstoqueSection
      products={products}
      addedItems={addedItems}
      onRemoveItem={id => {
        if (processingRef.current) return;
        setAddedItems(prev => prev.filter(item => item.id !== id));
      }}
      onUpdateItemQuantity={(id, quantity) => {
        if (processingRef.current) return;

        const selected = addedItems.find(item => item.id === id);
        if (!selected) return;

        const source = sourceProducts.find(
          p => p.id === selected.productId
        );
        if (!source) return;

        const others = addedItems
          .filter(item =>
            item.id !== id &&
            item.productId === selected.productId
          )
          .reduce((sum, item) => sum + item.qtdAdicionado, 0);

        const scaled = Math.round(quantity * 1000);

        if (
          !Number.isFinite(quantity) ||
          quantity <= 0 ||
          Math.abs(quantity * 1000 - scaled) > 0.000001 ||
          (source.quantityMode !== 'decimal' &&
            !Number.isInteger(quantity)) ||
          Math.round((others + quantity) * 1000) >
            Math.round(source.quantity * 1000)
        ) {
          setMessage('Quantidade inválida ou saldo insuficiente.');
          return;
        }

        setMessage('');
        setAddedItems(prev => prev.map(item =>
          item.id === id
            ? {
                ...item,
                qtdAdicionado: quantity,
                valorTotal: Math.max(
                  0,
                  quantity * item.precoUnitario -
                    (item.tipoDesconto === 'porcentagem'
                      ? quantity * item.precoUnitario *
                        item.desconto / 100
                      : item.desconto)
                )
              }
            : item
        ));
      }}
      onClearAddedItems={() => {
        if (!processingRef.current) setAddedItems([]);
      }}
      onConfirmBaixaAll={confirmBaixaAll}
      onConfirmEntradaAll={blocked}
      onQuickBaixa={blocked}
      onQuickEntrada={blocked}
      onOpenPhoto={setActivePhotoProduct}
      onOpenCadastro={() => { setEditingProduct(null); setIsCadastroOpen(true); }}
      onOpenListaProdutos={blocked}
      onOpenHistorico={blocked}
      onOpenEstoqueCritico={blocked}
    />
  );

  if (loading) {
    return <div className="p-6">Carregando estoque...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#cfd6dc] text-slate-900">
      <AppHeader
        onOpenListaProdutos={() => setIsListaModalOpen(true)}
        onOpenCadastro={() => { setEditingProduct(null); setIsCadastroOpen(true); }}
        onOpenFavoritos={() => setIsFavoritosOpen(true)}
        onOpenHistorico={blocked}
        onOpenGerenciarEstoques={() => setIsCompartilharOpen(true)}
        totalProductsCount={products.length}
        workspaces={[workspace]}
        activeWorkspace={workspace}
        onSelectWorkspace={blocked}
      />

      {message && (
        <div className="bg-amber-100 border-b border-amber-300
                        text-amber-900 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      <InventoryConflictsPanel
        familyId={familyId}
        onResolved={async () => {
          const result = await inventoryService.load(familyId);

          setSourceProducts(result.data.products);
          setProducts(result.data.products.filter(p => !p.archivedAt).map(toAIStudioProduct));
          setArchivedProducts(result.data.products.filter(p => Boolean(p.archivedAt)).map(toAIStudioProduct));

          setMessage(
            result.error ||
            'Estoque atualizado após a resolução do conflito.'
          );
        }}
      />

      <main className="flex-1 max-w-[1720px] w-full mx-auto
                       p-2 sm:p-4 grid grid-cols-1 lg:grid-cols-12
                       gap-3 sm:gap-4 items-start">
        <div className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-3">
          <TerminalPanel
            products={products}
            onOpenListaProdutos={() => setIsListaModalOpen(true)}
            onOpenFavoritos={() => setIsFavoritosOpen(true)}
            onOpenPhoto={setActivePhotoProduct}
            onAddItemToQueue={addToQueue}
            onQuickBaixa={blocked}
            onQuickEntrada={blocked}
            mobileSlot={movementSection}
          />
        </div>

        <div className="hidden lg:flex lg:col-span-7
                        xl:col-span-8 flex-col space-y-3">
          {movementSection}
        </div>
      </main>

      {isCadastroOpen && (
        <CadastroProdutoModal
          onClose={() => { setIsCadastroOpen(false); setEditingProduct(null); }}
          productToEdit={editingProduct}
          familyId={familyId}
          existingProducts={products}
          onSaveProduct={async (product) => {
            if (!familyId || familyId === 'v1') {
              throw new Error('Entre na sua família para salvar produtos.');
            }

            if (processingRef.current) {
              throw new Error('Aguarde a movimentação em andamento.');
            }

            const previous = sourceProducts.find(
              item => item.id === product.id
            );

            if (editingProduct && !previous) {
              throw new Error('Produto não encontrado. Atualize a lista antes de editar.');
            }
            if (previous && !navigator.onLine) {
              throw new Error('A edição exige conexão para verificar alterações de outros aparelhos.');
            }
            const homefinProduct = toHomeFinProduct(product, previous);

            const result = await inventoryService.saveProduct(
              familyId,
              homefinProduct
            );

            setSourceProducts(result.data.products);
            setProducts(result.data.products.filter(p => !p.archivedAt).map(toAIStudioProduct));
          setArchivedProducts(result.data.products.filter(p => Boolean(p.archivedAt)).map(toAIStudioProduct));

            if (!result.synced) {
              setMessage(
                result.error ||
                'Produto salvo localmente e aguardando sincronização.'
              );
            } else {
              setMessage('Produto cadastrado com sucesso.');
            }

            const photoMatch = product.fotoUrl.match(
              /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
            );

            if (photoMatch) {
              if (!result.synced) {
                setMessage(
                  'Produto salvo localmente. A foto precisa de conexão ' +
                  'e ainda não foi enviada.'
                );
              } else {
                const ownerFamilyId = localStorage.getItem(
                  `homefin_inventory_owner_${familyId}`
                ) || familyId;

                const token = await getFamilySessionToken(familyId);

                if (!token) {
                  throw new Error(
                    'Produto salvo, mas a sessão expirou antes do envio da foto.'
                  );
                }

                const photoResponse = await fetch(homefinApiUrl('/api/inventory-photo'), {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  body: JSON.stringify({
                    action: 'upload',
                    familyId,
                    productId: homefinProduct.id,
                    expectedOwnerFamilyId: ownerFamilyId,
                    imageBase64: photoMatch[1],
                  }),
                });

                const photoResult = await photoResponse.json();

                if (!photoResponse.ok) {
                  throw new Error(
                    'Produto salvo, mas a foto não foi enviada: ' +
                    (photoResult.error || 'Erro desconhecido.')
                  );
                }

                setMessage('Produto e foto cadastrados com sucesso.');
              }
            }
          }}
          nextCodigoInterno={String(products.length + 1).padStart(6, '0')}
        />
      )}

      {isCompartilharOpen && (
        <CompartilharEstoqueHomeFinModal
          familyId={familyId}
          onClose={() => setIsCompartilharOpen(false)}
          onChanged={async () => {
            const result = await inventoryService.load(familyId);
            setSourceProducts(result.data.products);
            setProducts(result.data.products.filter(p => !p.archivedAt).map(toAIStudioProduct));
          setArchivedProducts(result.data.products.filter(p => Boolean(p.archivedAt)).map(toAIStudioProduct));
            if (result.error) setMessage(result.error);
          }}
        />
      )}

      <ProductPhotoModal
        product={activePhotoProduct && (
          products.find(p => p.id === activePhotoProduct.id) || activePhotoProduct
        )}
        onClose={() => setActivePhotoProduct(null)}
      />

      <FavoritosModal
        isOpen={isFavoritosOpen}
        onClose={() => setIsFavoritosOpen(false)}
        products={products}
        onSelectProduct={product => {
          addProductFromTable(product);
        }}
        onOpenPhoto={setActivePhotoProduct}
      />

      <ListaProdutosModal
        isOpen={isListaModalOpen}
        onClose={() => setIsListaModalOpen(false)}
        products={products}
        archivedProducts={archivedProducts}
        addedItems={addedItems}
        onAddItem={addProductFromTable}
        onRemoveItem={id => {
          if (processingRef.current) return;
          setAddedItems(prev => prev.filter(item => item.id !== id));
        }}
        onUpdateItemQuantity={(id, quantity) => {
          if (processingRef.current) return;
          setMessage(
            'Altere a quantidade pela fila principal de conferência.'
          );
        }}
        onConfirmBaixaAll={confirmBaixaAll}
        onConfirmEntradaAll={blocked}
        onOpenPhoto={setActivePhotoProduct}
        onEditProduct={product => {
          if (processingRef.current) return;
          setIsListaModalOpen(false);
          setEditingProduct(product);
          setIsCadastroOpen(true);
        }}
        onToggleFavorite={toggleFavorite}
        onArchiveAction={async (product, action) => {
          if (processingRef.current) return;
          const source = sourceProducts.find(item => item.id === product.id);
          if (!source) { setMessage('Produto não encontrado. Atualize o Estoque.'); return; }
          const verb = action === 'archive' ? 'arquivar' : action === 'restore' ? 'restaurar' : 'excluir definitivamente';
          if (!window.confirm(`Deseja ${verb} o produto "${source.name}"?`)) return;
          processingRef.current = true;
          setProcessing(true);
          try {
            if (action === 'delete') await inventoryService.deleteConfirmed(familyId, source);
            else await inventoryService.setArchived(familyId, source, action === 'archive');
            if (action === 'delete') {
              // A exclusão já foi confirmada pelo servidor.
              // Remove imediatamente o produto das listas visíveis.
              setSourceProducts(current =>
                current.filter(item => item.id !== source.id)
              );
              setProducts(current =>
                current.filter(item => item.id !== source.id)
              );
              setArchivedProducts(current =>
                current.filter(item => item.id !== source.id)
              );
              setAddedItems(current =>
                current.filter(item => item.productId !== source.id)
              );
              setMessage('Produto excluído definitivamente.');
            } else {
              const refreshed = await inventoryService.load(familyId);
              setSourceProducts(refreshed.data.products);
              setProducts(refreshed.data.products.filter(p => !p.archivedAt).map(toAIStudioProduct));
              setArchivedProducts(refreshed.data.products.filter(p => Boolean(p.archivedAt)).map(toAIStudioProduct));
              setAddedItems(current => current.filter(item => item.productId !== source.id));
              setMessage(refreshed.error || `Produto atualizado: ${verb}.`);
            }
          } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Falha na operação.');
          } finally {
            processingRef.current = false;
            setProcessing(false);
          }
        }}
        onQuickBaixaItem={blocked}
        onQuickEntradaItem={blocked}
      />

    </div>
  );
}
