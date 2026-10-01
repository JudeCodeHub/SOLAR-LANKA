import { ProductNotFound } from "@/components/catalogue/detail/product-not-found";
import { messages } from "@/messages";

export default function NotFound() {
  return <ProductNotFound listHref="/panels" label={messages.detail.back.panel} />;
}
