import { Fragment } from "react";
import { CircleCheck, CircleX, Download, Heart, Info, OctagonAlert, TriangleAlert } from "lucide-react";

import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OverlayDemo } from "@/components/design/overlay-demo";
import { Pagination } from "@/components/catalogue/pagination";
import { Segmented, segmentedItemClass } from "@/components/ui/segmented";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableRegion } from "@/components/ui/table";
import { Badge, SampleBadge, TimeSensitiveBadge, VerifiedBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Photo } from "@/components/ui/photo";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Reveal } from "@/components/ui/reveal";
import { contrastRatio } from "@/lib/design/contrast";
import { CSS_NAMES, DARK, LIGHT, type Theme } from "@/lib/design/tokens";
import { PHOTOS, type PhotoKey } from "@/lib/photos/photos";
import { format, messages } from "@/messages";

const text = messages.design;

/** Each swatch as a literal class (so Tailwind finds it), in the order they are shown. */
const SWATCHES: [string, string][] = [
  ["bg", "bg-paper"],
  ["surface", "bg-surface"],
  ["surface-2", "bg-paper-2"],
  ["text", "bg-ink"],
  ["text-2", "bg-ink-2"],
  ["muted", "bg-ink-3"],
  ["line", "bg-line"],
  ["field-border", "bg-field-border"],
  ["orange", "bg-orange"],
  ["orange-hover", "bg-orange-hover"],
  ["orange-pressed", "bg-orange-pressed"],
  ["orange-text", "bg-orange-text"],
  ["orange-tint", "bg-orange-tint"],
  ["on-orange", "bg-on-orange"],
  ["focus", "bg-focus"],
  ["success", "bg-success"],
  ["warning", "bg-warning"],
  ["danger", "bg-danger"],
  ["info", "bg-info"],
  ["success-tint", "bg-success-tint"],
  ["warning-tint", "bg-warning-tint"],
  ["danger-tint", "bg-danger-tint"],
  ["info-tint", "bg-info-tint"],
  ["disabled-bg", "bg-disabled-bg"],
  ["disabled-text", "bg-disabled-text"],
];

const CARDS: ['flat' | 'raised' | 'outlined' | 'inset' | 'glass', string, string][] = [
  ["flat", text.cards.flat, text.cards.flatBody],
  ["raised", text.cards.raised, text.cards.raisedBody],
  ["outlined", text.cards.outlined, text.cards.outlinedBody],
  ["inset", text.cards.inset, text.cards.insetBody],
  ["glass", text.cards.glass, text.cards.glassBody],
];

function valueOf(theme: Theme, cssName: string): string {
  const tokens: Record<string, string> = theme === "light" ? LIGHT : DARK;
  const key = Object.entries(CSS_NAMES[theme]).find(([, name]) => name === cssName)?.[0] ?? "";
  return tokens[key] ?? "";
}

function Palette({ theme }: { theme: Theme }) {
  const background = valueOf(theme, "bg");
  return (
    <div className={`${theme === "light" ? "light" : "dark"} rounded-2xl border border-line bg-paper p-5 text-ink`}>
      <h3 className="type-subheading">{theme === "light" ? text.colour.light : text.colour.dark}</h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {SWATCHES.map(([cssName, swatch]) => {
          const value = valueOf(theme, cssName);
          return (
            <li key={cssName} className="flex items-center gap-3">
              <span aria-hidden className={`size-11 shrink-0 rounded-lg border border-line ${swatch}`} />
              <span className="min-w-0">
                <span className="block type-small font-medium">{text.colour.tokens[cssName]}</span>
                <span className="block type-caption type-figure text-ink-3">
                  {value} · {format(text.colour.onPage, { ratio: contrastRatio(value, background).toFixed(1) })}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** The development-only design review page. */
export function DesignGallery() {
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-4 py-12">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="max-w-2xl space-y-3">
          <h1 className="type-display-m">{text.title}</h1>
          <p className="type-body text-ink-2">{text.intro}</p>
        </div>
        <ThemeToggle />
      </header>

      <section aria-labelledby="colour-title" className="space-y-6">
        <h2 id="colour-title" className="type-heading">{text.colour.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.colour.intro}</p>
        <div className="grid gap-6 lg:grid-cols-2">
          <Palette theme="light" />
          <Palette theme="dark" />
        </div>
      </section>

      <section aria-labelledby="type-title" className="space-y-6">
        <h2 id="type-title" className="type-heading">{text.type.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.type.intro}</p>
        <div className="space-y-6 rounded-2xl border border-line bg-surface p-6">
          <p className="type-display-xl">{text.type.displayXl}</p>
          <p className="type-display-l">{text.type.displayL}</p>
          <p className="type-display-m">{text.type.displayM}</p>
          <p className="type-heading">{text.type.heading}</p>
          <p className="type-subheading">{text.type.subheading}</p>
          <p className="type-body max-w-3xl">{text.type.body}</p>
          <p className="type-small text-ink-2">{text.type.small}</p>
          <p className="type-caption text-ink-3">{text.type.caption}</p>
          <p className="type-figure text-2xl">{text.type.figure}</p>
        </div>
      </section>

      <section aria-labelledby="buttons-title" className="space-y-6">
        <h2 id="buttons-title" className="type-heading">{text.buttons.title}</h2>
        <div className="space-y-6 rounded-2xl border border-line bg-surface p-6">
          <div className="space-y-3">
            <h3 className="type-subheading">{text.buttons.variants}</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button>{text.buttons.primary}</Button>
              <Button variant="secondary">{text.buttons.secondary}</Button>
              <Button variant="outline">{text.buttons.outline}</Button>
              <Button variant="ghost">{text.buttons.ghost}</Button>
              <Button variant="destructive">{text.buttons.destructive}</Button>
              <Button variant="link">{text.buttons.link}</Button>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="type-subheading">{text.buttons.sizes}</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="xs">{text.buttons.small}</Button>
              <Button size="sm">{text.buttons.small}</Button>
              <Button>{text.buttons.primary}</Button>
              <Button size="lg">{text.buttons.large}</Button>
              <Button size="icon" variant="outline" aria-label={text.buttons.iconLabel}>
                <Heart aria-hidden />
              </Button>
              <Button variant="secondary">
                <Download aria-hidden data-icon="inline-start" />
                {text.buttons.withIcon}
              </Button>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="type-subheading">{text.buttons.states}</h3>
            <div className="flex flex-wrap items-center gap-3">
              <Button loading>{text.buttons.loading}</Button>
              <Button variant="outline" loading>{text.buttons.loading}</Button>
              <Button disabled>{text.buttons.disabled}</Button>
              <Button aria-disabled="true">{text.buttons.notAvailable}</Button>
              <Button variant="destructive" disabled>{text.buttons.destructive}</Button>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="fields-title" className="space-y-6">
        <h2 id="fields-title" className="type-heading">{text.fields.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.fields.intro}</p>
        <div className="grid gap-6 rounded-2xl border border-line bg-surface p-6 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="d-text">{text.fields.textLabel}</FieldLabel>
            <Input id="d-text" placeholder={text.fields.textPlaceholder} aria-describedby="d-text-help" />
            <FieldDescription id="d-text-help">{text.fields.textHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="d-select">{text.fields.selectLabel}</FieldLabel>
            <select id="d-select" className="field-control field-select h-11 w-full min-w-0 px-3.5 py-2" aria-describedby="d-select-help">
              {text.fields.options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
            <FieldDescription id="d-select-help">{text.fields.selectHint}</FieldDescription>
          </Field>
          <Field className="md:col-span-2">
            <FieldLabel htmlFor="d-area">{text.fields.areaLabel}</FieldLabel>
            <textarea id="d-area" rows={3} placeholder={text.fields.areaPlaceholder} className="field-control min-h-28 w-full min-w-0 px-3.5 py-3" />
          </Field>
          <Field data-invalid>
            <FieldLabel htmlFor="d-invalid">{text.fields.invalidLabel}</FieldLabel>
            <Input id="d-invalid" defaultValue={text.fields.invalidValue} aria-invalid="true" aria-describedby="d-invalid-error" />
            <FieldError id="d-invalid-error" role={undefined}>{text.fields.invalidError}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="d-disabled">{text.fields.disabledLabel}</FieldLabel>
            <Input id="d-disabled" defaultValue={text.fields.disabledValue} disabled />
          </Field>
          <fieldset className="space-y-3 md:col-span-2">
            <legend className="type-subheading mb-2">{text.fields.checkboxes}</legend>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <label className="flex min-h-11 items-center gap-3 type-small">
                <input type="checkbox" className="field-check size-6" defaultChecked />
                {text.fields.checkboxOne}
              </label>
              <label className="flex min-h-11 items-center gap-3 type-small">
                <input type="checkbox" className="field-check size-6" />
                {text.fields.checkboxTwo}
              </label>
              <label className="flex min-h-11 items-center gap-3 type-small">
                <input type="radio" name="d-kind" className="field-radio size-6" defaultChecked />
                {text.fields.radioOne}
              </label>
              <label className="flex min-h-11 items-center gap-3 type-small">
                <input type="radio" name="d-kind" className="field-radio size-6" />
                {text.fields.radioTwo}
              </label>
              <label className="flex min-h-11 items-center gap-3 type-small">
                <input type="checkbox" className="field-switch" defaultChecked />
                {text.fields.switchLabel}
              </label>
              <label className="flex min-h-11 items-center gap-3 type-small">
                <input type="checkbox" className="field-switch" />
                {text.fields.switchOff}
              </label>
              <label className="flex min-h-11 items-center gap-3 type-small text-ink-3">
                <input type="checkbox" className="field-check size-6" disabled />
                {text.fields.disabledCheck}
              </label>
            </div>
          </fieldset>
        </div>
      </section>

      <section aria-labelledby="alerts-title" className="space-y-6">
        <h2 id="alerts-title" className="type-heading">{text.alerts.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.alerts.intro}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Alert role="status" variant="info"><Info aria-hidden /><AlertTitle>{text.alerts.infoTitle}</AlertTitle><AlertDescription>{text.alerts.body}</AlertDescription></Alert>
          <Alert role="status" variant="success"><CircleCheck aria-hidden /><AlertTitle>{text.alerts.successTitle}</AlertTitle><AlertDescription>{text.alerts.body}</AlertDescription></Alert>
          <Alert role="status" variant="warning"><TriangleAlert aria-hidden /><AlertTitle>{text.alerts.warningTitle}</AlertTitle><AlertDescription>{text.alerts.body}</AlertDescription></Alert>
          <Alert role="status" variant="danger"><CircleX aria-hidden /><AlertTitle>{text.alerts.dangerTitle}</AlertTitle><AlertDescription>{text.alerts.body}</AlertDescription></Alert>
        </div>
        <Alert role="status" variant="hazard">
          <OctagonAlert aria-hidden />
          <div className="space-y-1"><p>{text.alerts.hazardTitle}</p><p>{text.alerts.hazardBody}</p></div>
        </Alert>
      </section>

      <section aria-labelledby="tables-title" className="space-y-6">
        <h2 id="tables-title" className="type-heading">{text.tables.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.tables.intro}</p>
        <TableRegion label={text.tables.region} className="max-h-64">
          <Table className="min-w-[44rem]">
            <caption className="sr-only">{text.tables.region}</caption>
            <thead>
              <tr>
                {Object.values(text.tables.columns).map((column) => (
                  <th key={column} scope="col" className="text-left">{column}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(text.tables.rows).map(([id, row]) => (
                <tr key={id}>
                  <th scope="row" className="text-left font-normal">{row.quotation}</th>
                  <td>{row.size}</td>
                  <td>{row.panels}</td>
                  <td>{row.inverter}</td>
                  <td>{row.warranty}</td>
                  <td>{row.total}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableRegion>
        <dl className="description-list max-w-xl text-sm">
          {Object.entries(text.tables.facts).map(([id, fact]) => (
            <Fragment key={id}>
              <dt>{fact.term}</dt>
              <dd>{fact.value}</dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section aria-labelledby="navigation-title" className="space-y-6">
        <h2 id="navigation-title" className="type-heading">{text.navigation.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.navigation.intro}</p>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.navigation.tabs}</h3>
          <Tabs defaultValue="overview">
            <TabsList aria-label={text.navigation.tabs}>
              <TabsTrigger value="overview">{text.navigation.overview}</TabsTrigger>
              <TabsTrigger value="specs">{text.navigation.specs}</TabsTrigger>
              <TabsTrigger value="documents">{text.navigation.documents}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="type-body text-ink-2">{text.navigation.overviewBody}</TabsContent>
            <TabsContent value="specs" className="type-body text-ink-2">{text.navigation.specsBody}</TabsContent>
            <TabsContent value="documents" className="type-body text-ink-2">{text.navigation.documentsBody}</TabsContent>
          </Tabs>
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.navigation.segmented}</h3>
          <Segmented label={text.navigation.segmented}>
            <button type="button" aria-pressed="true" className={segmentedItemClass(true)}>{text.navigation.monthly}</button>
            <button type="button" aria-pressed="false" className={segmentedItemClass(false)}>{text.navigation.yearly}</button>
            <button type="button" aria-pressed="false" className={segmentedItemClass(false)}>{text.navigation.lifetime}</button>
          </Segmented>
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.navigation.pagination}</h3>
          <Pagination hrefFor={(page) => `/design?page=${page}`} page={3} pageCount={9} />
        </div>
      </section>

      <section aria-labelledby="overlays-title" className="space-y-6">
        <h2 id="overlays-title" className="type-heading">{text.overlays.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.overlays.intro}</p>
        <OverlayDemo />
      </section>

      <section aria-labelledby="badges-title" className="space-y-6">
        <h2 id="badges-title" className="type-heading">{text.badges.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.badges.intro}</p>
        <div className="space-y-6 rounded-2xl border border-line bg-surface p-6">
          <div className="space-y-3">
            <h3 className="type-subheading">{text.badges.variants}</h3>
            <div className="flex flex-wrap gap-3">
              <Badge>{text.badges.neutral}</Badge>
              <Badge variant="orange">{text.badges.orange}</Badge>
              <Badge variant="success">{text.badges.success}</Badge>
              <Badge variant="warning">{text.badges.warning}</Badge>
              <Badge variant="danger">{text.badges.danger}</Badge>
              <Badge variant="info">{text.badges.info}</Badge>
            </div>
          </div>
          <div className="space-y-3">
            <h3 className="type-subheading">{text.badges.presets}</h3>
            <div className="flex flex-wrap gap-3">
              <SampleBadge>{text.badges.sample}</SampleBadge>
              <VerifiedBadge>{text.badges.verified}</VerifiedBadge>
              <TimeSensitiveBadge>{text.badges.timeSensitive}</TimeSensitiveBadge>
              <Badge variant="danger">{text.badges.overdue}</Badge>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="cards-title" className="space-y-6">
        <h2 id="cards-title" className="type-heading">{text.cards.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.cards.intro}</p>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.cards.onPage}</h3>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-5">
            {CARDS.map(([variant, title, body]) => (
              <Card key={variant} variant={variant}>
                <CardHeader>
                  <CardTitle className="type-subheading">{title}</CardTitle>
                  <CardDescription>{body}</CardDescription>
                </CardHeader>
                <CardContent />
              </Card>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.cards.overPhoto}</h3>
          <div className="relative overflow-hidden rounded-panel">
            <Photo name="hero" sizes="(min-width: 1024px) 1100px, 100vw" className="absolute inset-0 size-full object-cover" />
            <div className="relative grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-5 lg:p-10">
              {CARDS.map(([variant, title, body]) => (
                <Card key={variant} variant={variant}>
                  <CardHeader>
                    <CardTitle className="type-subheading">{title}</CardTitle>
                    <CardDescription>{body}</CardDescription>
                  </CardHeader>
                  <CardContent />
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="surfaces-title" className="space-y-6">
        <h2 id="surfaces-title" className="type-heading">{text.surfaces.title}</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-6 shadow-sm">
            <h3 className="type-subheading">{text.surfaces.cardTitle}</h3>
            <p className="type-small text-ink-2">{text.surfaces.cardBody}</p>
          </div>
          <div className="space-y-2 rounded-2xl border border-line bg-orange-tint p-6">
            <h3 className="type-subheading">{text.surfaces.tintTitle}</h3>
            <p className="type-small text-ink-2">{text.surfaces.tintBody}</p>
          </div>
          <div className="space-y-2 rounded-2xl border border-line bg-surface p-6">
            <Label htmlFor="design-field">{text.surfaces.fieldLabel}</Label>
            <Input id="design-field" placeholder={text.surfaces.fieldPlaceholder} inputMode="decimal" />
            <p className="type-caption text-ink-3">{text.surfaces.fieldHelp}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="layout-title" className="space-y-8">
        <h2 id="layout-title" className="type-heading">{text.layout.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.layout.intro}</p>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.layout.containers}</h3>
          <div className="space-y-2">
            <p className="type-small max-w-content rounded-card bg-orange-tint px-3 py-2">{text.layout.content}</p>
            <p className="type-small max-w-reading rounded-card bg-orange-tint px-3 py-2">{text.layout.reading}</p>
            <p className="type-small max-w-wide rounded-card bg-orange-tint px-3 py-2">{text.layout.wide}</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.layout.radii}</h3>
          <div className="flex flex-wrap gap-4">
            <p className="type-small rounded-field border border-field-border bg-surface px-4 py-6">{text.layout.field}</p>
            <p className="type-small rounded-card border border-field-border bg-surface px-4 py-6">{text.layout.card}</p>
            <p className="type-small rounded-panel border border-field-border bg-surface px-4 py-6">{text.layout.panel}</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.layout.elevation}</h3>
          <div className="grid gap-6 sm:grid-cols-3">
            <p className="type-small rounded-card bg-surface p-6 shadow-e1">{text.layout.level1}</p>
            <p className="type-small rounded-card bg-surface p-6 shadow-e2">{text.layout.level2}</p>
            <p className="type-small rounded-card bg-surface p-6 shadow-e3">{text.layout.level3}</p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="type-subheading">{text.layout.textures}</h3>
          <div className="grid gap-8 md:grid-cols-3">
            <p className="type-small grain rounded-panel border border-line bg-surface p-8">{text.layout.grain}</p>
            <p className="type-small bg-blueprint rounded-panel border border-line bg-paper p-8">{text.layout.blueprint}</p>
            <p className="type-small reg-marks rounded-card border border-field-border bg-surface p-8">{text.layout.marks}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="motion-title" className="space-y-6">
        <h2 id="motion-title" className="type-heading">{text.motion.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.motion.intro}</p>
        <p className="type-small type-figure text-ink-3">{text.motion.durations}</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Reveal><p className="type-small rounded-card border border-line bg-surface p-5 shadow-e1">{text.motion.first}</p></Reveal>
          <Reveal delay={1}><p className="type-small rounded-card border border-line bg-surface p-5 shadow-e1">{text.motion.second}</p></Reveal>
          <Reveal delay={2}><p className="type-small rounded-card border border-line bg-surface p-5 shadow-e1">{text.motion.third}</p></Reveal>
          <Reveal delay={3}><p className="type-small rounded-card border border-line bg-surface p-5 shadow-e1">{text.motion.fourth}</p></Reveal>
        </div>
      </section>

      <section aria-labelledby="photos-title" className="space-y-6">
        <h2 id="photos-title" className="type-heading">{text.photos.title}</h2>
        <p className="type-body max-w-3xl text-ink-2">{text.photos.intro}</p>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(Object.keys(PHOTOS) as PhotoKey[]).map((name) => (
            <li key={name} className="space-y-1.5">
              <Photo name={name} sizes="(min-width: 1024px) 25vw, 50vw" className="aspect-[3/2] w-full rounded-xl object-cover" />
              <p className="type-caption type-figure text-ink-3">{name}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
