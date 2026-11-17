import type { InventoryProduct, InventoryMovement } from '../../../types/inventory';
import type { Product, StockMovement } from '../types';

export function toAIStudioProduct(product: InventoryProduct): Product {
  return {
    id: product.id,
    codigoInterno: product.sku || product.id,
    codigoBarras: product.barcode || '',
    descricao: product.name,
    medida: product.measure || '',
    unidade: product.unit || (
      product.quantityMode === 'decimal' ? 'UN. FRACIONADA' : 'UN'
    ),
    marcaRefer: product.category || '',
    estoqueAtual: Number(product.quantity ?? 0),
    precoVarejo: Number(product.salePrice ?? 0),
    precoAtacado: Number(product.wholesalePrice ?? 0),
    valorProm: Number(product.promotionalPrice ?? 0),
    ncm: product.ncm || '',
    pesoBruto: 0,
    pesoLiquido: 0,
    vendaMediaMensal: Number(product.averageMonthlySales ?? 0),
    observacao: product.notes || '',
    fotoUrl: '',
    favorito: Boolean(product.favorite),
    estoqueMinimo: Number(product.minimumQuantity ?? 0),
  };
}

export function toHomeFinProduct(
  product: Product,
  previous?: InventoryProduct
): InventoryProduct {
  const quantity = Number(product.estoqueAtual);
  const minimumQuantity = Number(
    product.estoqueMinimo ?? previous?.minimumQuantity ?? 0
  );

  if (
    !Number.isFinite(quantity) ||
    quantity < 0 ||
    !Number.isFinite(minimumQuantity) ||
    minimumQuantity < 0
  ) {
    throw new Error('Quantidade do produto inválida.');
  }

  const hasFraction = [quantity, minimumQuantity].some(
    value => !Number.isInteger(value)
  );

  const quantityMode = hasFraction
    ? 'decimal'
    : previous?.quantityMode || 'integer';

  return {
    id: product.id,
    name: product.descricao.trim(),
    sku: product.codigoInterno.trim(),
    category: product.marcaRefer || previous?.category || '',
    supplier: previous?.supplier || '',
    quantity,
    minimumQuantity,
    quantityMode,
    costPrice: previous?.costPrice ?? 0,
    salePrice: Number(product.precoVarejo ?? 0),
    wholesalePrice: Number(product.precoAtacado ?? 0),
    barcode: product.codigoBarras || '',
    measure: product.medida || '',
    unit: product.unidade || 'UN',
    ncm: product.ncm || '',
    promotionalPrice: Number(product.valorProm ?? 0),
    averageMonthlySales: Number(product.vendaMediaMensal ?? 0),
    notes: product.observacao || '',
    favorite: Boolean(product.favorito),
    ...(previous?.photoStoragePath
      ? { photoStoragePath: previous.photoStoragePath }
      : {}),
    // Edições preservam a versão original do servidor.
    // Produtos novos não possuem versão anterior.
    updatedAt: previous?.updatedAt || '',
  };
}

export function toAIStudioMovement(
  movement: InventoryMovement,
  products: InventoryProduct[]
): StockMovement {
  const product = products.find(item => item.id === movement.productId);

  return {
    id: movement.id,
    timestamp: new Date(movement.createdAt).toLocaleString('pt-BR'),
    productId: movement.productId,
    codigoInterno: product?.sku || '',
    descricao: product?.name || movement.productNameSnapshot || 'Produto excluído',
    tipo: movement.type === 'entry' ? 'entrada' : 'baixa',
    quantidade: Number(movement.quantity || 0),
    estoqueAnterior: 0,
    estoqueNovo: 0,
    motivo: movement.note || '',
  };
}
