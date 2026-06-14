import { NextRequest } from "next/server";
import { getProducts, patchProducts } from "@/server/products/product-service";

export async function GET(request: NextRequest) {
  return getProducts(request);
}

export async function PATCH(request: NextRequest) {
  return patchProducts(request);
}
