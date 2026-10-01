"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldValues, type Resolver, useForm, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

import { installZodMessages } from "./zod-messages";

installZodMessages();

/** The form convention: validate with a Zod schema. */
export function useAppForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, "resolver">,
) {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    // The resolver package types its result loosely for generic schemas.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<TSchema>, unknown, z.output<TSchema>>,
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: false,
    ...options,
  });
}
