export interface MLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: number;
  refresh_token: string;
}

export interface MLItemSearchResponse {
  seller_id: string;
  query: string;
  paging: {
    limit: number;
    offset: number;
    total: number;
  };
  results: string[];
  orders: any[];
  available_orders: any[];
}

export interface MLItem {
  id: string;
  title: string;
  seller_id: number;
  category_id: string;
  price: number;
  base_price: number;
  original_price: number | null;
  currency_id: string;
  initial_quantity: number;
  available_quantity: number;
  sold_quantity: number;
  condition: string;
  permalink: string;
  status: string;
  shipping: {
    mode: string;
    local_pick_up: boolean;
    free_shipping: boolean;
    logistic_type: 'fulfillment' | 'cross_docking' | 'drop_off' | 'custom' | 'not_specified' | string;
    store_pick_up: boolean;
  };
  attributes: any[];
  date_created: string;
  last_updated: string;
}

export interface MLMultigetResponse {
  code: number;
  body: MLItem;
}

export interface MLIntegrationData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // timestamp in milliseconds
  user_id: number; // ML user id
  updated_at: number; // timestamp of last sync/update
}

export interface MLFullInventorySnapshot {
  item_id: string;
  title: string;
  available_quantity: number;
  status: string;
  logistic_type: string;
  permalink: string;
  snapshot_at: number; // timestamp
}
