export type InventoryMovementType = 'entry' | 'exit';

export interface InventoryProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  supplier: string;
  quantity: number;
  minimumQuantity: number;
  costPrice: number;
  salePrice: number;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  type: InventoryMovementType;
  quantity: number;
  note: string;
  createdAt: string;
}

export interface InventoryData {
  products: InventoryProduct[];
  movements: InventoryMovement[];
}
