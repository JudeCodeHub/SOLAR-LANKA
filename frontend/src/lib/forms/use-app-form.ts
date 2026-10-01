"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { type FieldValues, type Resolver, useForm, type UseFormProps } from "react-hook-form";
import type { z } from "zod";

import { installZodMessages } from "./zod-messages";

installZodMessages();

/**
 * The form convention: validate with a Zod schema (the browser check is for convenience, the
 * backend still decides), show an error when a field is left, re-check as the user types, and
 * focus the error summary rather than the first field when a submit fails.
 *
 * Give `defaultValues` for every field (use "" for empty text): the form uses them to know
 * which fields exist when mapping backend validation issues onto fields.
 */
export function useAppForm<TSchema extends z.ZodType<FieldValues, FieldValues>>(
  schema: TSchema,
  options?: Omit<UseFormProps<z.input<TSchema>, unknown, z.output<TSchema>>, "resolver">,
) {
  return useForm<z.input<TSchema>, unknown, z.output<TSchema>>({
    // The resolver package types its result loosely for generic schemas; the schema is the source
    // of truth for both the input and output types.
    resolver: zodResolver(schema) as unknown as Resolver<z.input<TSchema>, unknown, z.output<TSchema>>,
    mode: "onTouched",
    reValidateMode: "onChange",
    shouldFocusError: false,
    ...options,
  });
}
