import { ProductNotFound } from "@/components/catalogue/detail/product-not-found";
import { messages } from "@/messages";

export default function NotFound() {
  return <ProductNotFound listHref="/inverters" label={messages.detail.back.inverter} />;
}
