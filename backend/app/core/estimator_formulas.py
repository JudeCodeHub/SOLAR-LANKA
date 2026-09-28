"""Calculation specification for on-grid net metering without batteries.

All numbers in the examples are *fictional teaching inputs*, not configured
Sri Lankan yields, tariffs, prices, or guarantees. Production code must use a
published configuration with dated sources (see estimator_sources.py). Until
then, suppress generation, cost, savings, and payback results.

Inputs and units
----------------
C = monthly consumption (kWh/month); A = usable roof area (m²);
P = panel nameplate power (W/panel); a = installed area including spacing
(m²/panel); Y = location-specific annual yield (kWh/kWp/year); f = roof and
shading factor in [0, 1]. P, a, Y, and f must be explicit, sourced/configured
assumptions; unknown shading is not automatically treated as unshaded.

Sizing and generation
---------------------
N_roof = floor(A / a) panels; K_roof = N_roof × P / 1000 kWp.
K_target = (12 × C) / Y kWp (unshaded planning target, before panel rounding).
N_target = ceil(1000 × K_target / P) panels.
N = min(N_roof, N_target); K = N × P / 1000 kWp.
G_year = K × Y × f kWh/year; G_month = G_year / 12 kWh/month.
If A = 0, N = K = G_year = 0. If C = 0, N_target = 0. Reject a <= 0,
P <= 0, Y <= 0, or factors outside [0, 1]. The monthly figure is an annual
average, not a month-by-month weather forecast. Report a *range* only when
separate sourced low/high yield or loss assumptions exist; never fabricate a
percentage interval around one estimate.

Net-metering financial rule
---------------------------
For each billing period, estimate metered net imports and carry-forward energy
credits under the applicable verified scheme rules. Compare the *full* tariff
bill for baseline imports with the full tariff bill for imports after credits:
savings = baseline_bill - solar_bill, both in LKR/period. Tariff blocks, fixed
charges, taxes, and credit carry-forward must be modelled explicitly. Exported
energy has no cash price in this scheme. Unknown daytime use prevents a
credible self-consumption/export split. Installed_cost is a dated, scoped
quote in LKR. Simple_payback_years = installed_cost / annual_net_savings only
when annual_net_savings > 0 and both values are known; otherwise null. This
simple payback omits financing, degradation, maintenance, and replacements
unless a future version models them explicitly.

Hand-checkable fictional examples (not live output)
--------------------------------------------------
Example A: C=300 kWh/month, A=30 m², P=500 W, a=2.5 m²/panel,
Y=1500 kWh/kWp/year, f=0.8. N_roof=floor(30/2.5)=12; K_roof=6 kWp.
K_target=(12×300)/1500=2.4 kWp; N_target=ceil(1000×2.4/500)=5.
N=5; K=5×500/1000=2.5 kWp; installed area=5×2.5=12.5 m².
G_year=2.5×1500×0.8=3000 kWh/year; G_month=250 kWh/month.
No LKR savings or payback follows from these generation figures alone.

Example B (roof-limited): same fictional assumptions except A=10 m².
N_roof=floor(10/2.5)=4; N_target=5; N=4; K=2 kWp.
Installed area=10 m²; G_year=2×1500×0.8=2400 kWh/year;
G_month=200 kWh/month. An unknown Y or quote produces null generation
or cost/payback respectively, never zero; a genuinely zero area produces
zero capacity and generation.
"""
