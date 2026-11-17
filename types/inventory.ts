export type InventoryMovementType = 'entry' | 'exit';

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  supplier: string;
  quantity: number;
  minimumQuantity: number;
  quantityMode: 'integer' | 'decimal';
  costPrice: number;
  salePrice: number;
  wholesalePrice: number;
  barcode?: string;
  measure?: string;
  unit?: string;
  ncm?: string;
  promotionalPrice?: number;
  averageMonthlySales?: number;
  notes?: string;
  favorite?: boolean;
  photoStoragePath?: string;
  updatedAt: string;
  archivedAt?: string | null;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productNameSnapshot?: string;
  type: InventoryMovementType;
  quantity: number;
  note: string;
  createdAt: string;
}

export interface InventoryData {
  products: InventoryProduct[];
  movements: InventoryMovement[];
}
