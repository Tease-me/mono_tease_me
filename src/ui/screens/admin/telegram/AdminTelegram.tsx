import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "@/api/apis";
import { Endpoints } from "@/api/urls";
import {
  TelegramServices,
  AvailableNumber,
  NumberSearchParams,
  ProvisionedNumber,
} from "@/api/services/TelegramServices";
import AdminLayout from "@/ui/screens/admin/AdminLayout";
import s from "./AdminTelegram.module.css";

const telegram = TelegramServices(apiClient);

type TwilioCountry = { country_code: string; country: string };

type Influencer = {
  id: string;
  display_name?: string;
};

type WizardStep = 1 | 2 | 3;

/* ── helpers ──────────────────────────────────── */

function badgeColor(status: string) {
  const st = status.toLowerCase();
  if (st === "active" || st === "verified") return s["badge--green"];
  if (st.includes("pending") || st === "code_sent" || st === "purchasing")
    return s["badge--yellow"];
  if (st.includes("fail") || st.includes("error")) return s["badge--red"];
  return s["badge--gray"];
}

function capClass(cap: string) {
  const k = cap.toLowerCase();
  if (k === "sms") return s["cap-badge--sms"];
  if (k === "voice") return s["cap-badge--voice"];
  if (k === "mms") return s["cap-badge--mms"];
  return "";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ═════════════════════════════════════════════════ */
/* Component                                        */
/* ═════════════════════════════════════════════════ */

const AdminTelegram: React.FC = () => {
  /* ── wizard ───────────────────────────────── */
  const [step, setStep] = useState<WizardStep>(1);

  /* ── step 1 ───────────────────────────────── */
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loadingInf, setLoadingInf] = useState(false);
  const [selInf, setSelInf] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  /* ── step 2 ───────────────────────────────── */
  const [countries, setCountries] = useState<TwilioCountry[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [country, setCountry] = useState("US");
  const [numType, setNumType] = useState("local");
  const [areaCode, setAreaCode] = useState("");
  const [contains, setContains] = useState("");
  const [available, setAvailable] = useState<AvailableNumber[]>([]);
  const [searching, setSearching] = useState(false);
  const [selNum, setSelNum] = useState<AvailableNumber | null>(null);
  const [countrySearch, setCountrySearch] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

  /* ── step 3 ───────────────────────────────── */
  const [provisioning, setProvisioning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  /* ── table ────────────────────────────────── */
  const [rows, setRows] = useState<ProvisionedNumber[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [tableErr, setTableErr] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<number | null>(null);

  /* ── load influencers ─────────────────────── */
  useEffect(() => {
    let ok = true;
    setLoadingInf(true);
    apiClient
      .get(Endpoints.influencers)
      .then(({ data }) => {
        if (!ok) return;
        setInfluencers(
          (data || [])
            .filter((i: any) => i.id)
            .map((i: any) => ({
              id: i.id,
              display_name: i.display_name || i.id,
            }))
        );
      })
      .catch(() => {})
      .finally(() => ok && setLoadingInf(false));
    return () => { ok = false; };
  }, []);

  /* ── load provisioned ─────────────────────── */
  const loadRows = useCallback(async () => {
    setLoadingRows(true);
    setTableErr(null);
    try {
      const d = await telegram.listProvisioned();
      setRows(d.numbers);
    } catch {
      setTableErr("Failed to load provisioned numbers.");
    } finally {
      setLoadingRows(false);
    }
  }, []);

  useEffect(() => { loadRows(); }, [loadRows]);

  /* ── load Twilio countries ─────────────────── */
  useEffect(() => {
    let ok = true;
    setLoadingCountries(true);
    telegram
      .fetchCountries()
      .then(({ countries: list }) => {
        if (!ok) return;
        // Sort alphabetically by country name
        setCountries(list.sort((a, b) => a.country.localeCompare(b.country)));
      })
      .catch(() => {})
      .finally(() => ok && setLoadingCountries(false));
    return () => { ok = false; };
  }, []);

  /* ── close country dropdown on click outside ── */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* ── derived ──────────────────────────────── */
  const inf = useMemo(
    () => influencers.find((i) => i.id === selInf),
    [influencers, selInf]
  );

  useEffect(() => {
    if (inf) {
      setFirstName(inf.display_name || inf.id);
      setLastName("");
    }
  }, [inf]);

  /* ── handlers ─────────────────────────────── */
  const goStep2 = () => selInf && setStep(2);

  const doSearch = async () => {
    setSearching(true);
    setSelNum(null);
    try {
      const p: NumberSearchParams = { country_code: country, number_type: numType, limit: 20 };
      if (areaCode.trim()) p.area_code = areaCode.trim();
      if (contains.trim()) p.contains = contains.trim();
      setAvailable((await telegram.searchNumbers(p)).numbers);
    } catch {
      setAvailable([]);
    } finally {
      setSearching(false);
    }
  };

  const goStep3 = () => { if (selNum) { setStep(3); setResult(null); } };

  const doProvision = async () => {
    if (!selNum || !selInf) return;
    setProvisioning(true);
    setResult(null);
    try {
      const r = await telegram.provision({
        phone_number: selNum.phone_number,
        influencer_id: selInf,
        first_name: firstName || "User",
        last_name: lastName,
      });
      setResult({ ok: r.ok, message: r.message });
      if (r.ok) loadRows();
    } catch (e: any) {
      setResult({ ok: false, message: e?.response?.data?.detail || e?.message || "Provisioning failed." });
    } finally {
      setProvisioning(false);
    }
  };

  const doRetry = async (id: number) => {
    setRowBusy(id);
    try { await telegram.retryProvision(id); await loadRows(); } catch {}
    setRowBusy(null);
  };

  const doRelease = async (id: number) => {
    if (!window.confirm("Release this number? The Twilio number will be deleted.")) return;
    setRowBusy(id);
    try { await telegram.releaseNumber(id); await loadRows(); } catch {}
    setRowBusy(null);
  };

  const resetWizard = () => {
    setStep(1);
    setSelNum(null);
    setAvailable([]);
    setResult(null);
  };

  /* ═══════════════════════════════════════════ */
  /* Render                                      */
  /* ═══════════════════════════════════════════ */

  return (
    <AdminLayout
      title="Telegram"
      subtitle="Provision Twilio numbers and create Telegram sessions for influencers."
    >
      <div className={s.page}>
        {/* ─────────────── WIZARD CARD ─────────────── */}
        <div className={s.card}>
          {/* Stepper */}
          <div className={s.stepper}>
            {[
              { n: 1, label: "Select Influencer" },
              { n: 2, label: "Choose Number" },
              { n: 3, label: "Provision" },
            ].map(({ n, label }, i) => (
              <React.Fragment key={n}>
                {i > 0 && (
                  <div className={`${s["step-connector"]} ${step > n - 1 ? s["step-connector--done"] : ""}`} />
                )}
                <div
                  className={`${s.step} ${step === n ? s["step--active"] : ""} ${step > n ? s["step--done"] : ""}`}
                >
                  <span className={s["step-num"]}>
                    {step > n ? "✓" : n}
                  </span>
                  {label}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Body */}
          <div className={s["card-body"]}>
            {/* ── STEP 1 ── */}
            {step === 1 && (
              <>
                <div className={s["form-grid"]}>
                  <div className={s.field}>
                    <label className={s.label}>Influencer</label>
                    <select
                      className={s.select}
                      value={selInf}
                      onChange={(e) => setSelInf(e.target.value)}
                      disabled={loadingInf}
                    >
                      <option key="__placeholder" value="">
                        {loadingInf ? "Loading…" : "Select an influencer"}
                      </option>
                      {influencers.map((inf) => (
                        <option key={`inf-${inf.id}`} value={inf.id}>
                          {inf.display_name || inf.id}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={s.field} />

                  <div className={s.field}>
                    <label className={s.label}>Telegram First Name</label>
                    <input
                      className={s.input}
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Sofia"
                    />
                  </div>

                  <div className={s.field}>
                    <label className={s.label}>Last Name (optional)</label>
                    <input
                      className={s.input}
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className={s.actions}>
                  <button
                    className={s["btn-primary"]}
                    onClick={goStep2}
                    disabled={!selInf}
                  >
                    Next → Search Numbers
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2 ── */}
            {step === 2 && (
              <>
                <div className={s["form-grid"]}>
                <div className={s.field}>
                    <label className={s.label}>Country</label>
                    <div className={s["country-search-wrap"]} ref={countryRef}>
                      <input
                        className={s["country-search-input"]}
                        type="text"
                        value={countryOpen ? countrySearch : (countries.find(c => c.country_code === country)?.country || country)}
                        onChange={(e) => {
                          setCountrySearch(e.target.value);
                          if (!countryOpen) setCountryOpen(true);
                        }}
                        onFocus={() => {
                          setCountryOpen(true);
                          setCountrySearch("");
                        }}
                        placeholder={loadingCountries ? "Loading countries…" : "Search country…"}
                        disabled={loadingCountries}
                      />
                      {countryOpen && country && (
                        <button
                          className={s["country-search-clear"]}
                          onClick={() => { setCountrySearch(""); }}
                          type="button"
                        >✕</button>
                      )}
                      {countryOpen && (
                        <div className={s["country-dropdown"]}>
                          {countries
                            .filter(c =>
                              !countrySearch ||
                              c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
                              c.country_code.toLowerCase().includes(countrySearch.toLowerCase())
                            )
                            .map(c => (
                              <div
                                key={c.country_code}
                                className={`${s["country-option"]} ${c.country_code === country ? s["country-option--selected"] : ""}`}
                                onClick={() => {
                                  setCountry(c.country_code);
                                  setCountryOpen(false);
                                  setCountrySearch("");
                                }}
                              >
                                <span>{c.country}</span>
                                <span className={s["country-code"]}>{c.country_code}</span>
                              </div>
                            ))}
                          {countries.filter(c =>
                            !countrySearch ||
                            c.country.toLowerCase().includes(countrySearch.toLowerCase()) ||
                            c.country_code.toLowerCase().includes(countrySearch.toLowerCase())
                          ).length === 0 && (
                            <div className={s["country-option"]} style={{ opacity: 0.4, cursor: "default" }}>
                              No countries match "{countrySearch}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={s.field}>
                    <label className={s.label}>Number Type</label>
                    <select
                      className={s.select}
                      value={numType}
                      onChange={(e) => setNumType(e.target.value)}
                    >
                      <option value="local">Local</option>
                      <option value="mobile">Mobile</option>
                      <option value="toll_free">Toll-Free</option>
                    </select>
                  </div>

                  <div className={s.field}>
                    <label className={s.label}>Area Code</label>
                    <input
                      className={s.input}
                      type="text"
                      value={areaCode}
                      onChange={(e) => setAreaCode(e.target.value)}
                      placeholder="e.g. 415"
                    />
                  </div>

                  <div className={s.field}>
                    <label className={s.label}>Contains</label>
                    <input
                      className={s.input}
                      type="text"
                      value={contains}
                      onChange={(e) => setContains(e.target.value)}
                      placeholder="e.g. 777"
                    />
                  </div>
                </div>

                <div className={s.actions}>
                  <button className={s["btn-primary"]} onClick={doSearch} disabled={searching}>
                    {searching ? (
                      <><span className={s.spinner} /> Searching…</>
                    ) : (
                      "🔍 Search Numbers"
                    )}
                  </button>
                </div>

                {/* Number results */}
                {available.length > 0 && (
                  <div className={s["numbers-scroll"]}>
                    <div className={s["results-header"]}>
                      <span className={s["results-count"]}>
                        {available.length} numbers found
                      </span>
                      <span className={s["results-hint"]}>
                        SMS capability required for Telegram verification
                      </span>
                    </div>
                    <div className={s["numbers-grid"]}>
                      {available.map((num) => (
                        <div
                          key={num.phone_number}
                          className={`${s["number-card"]} ${selNum?.phone_number === num.phone_number ? s["number-card--selected"] : ""}`}
                          onClick={() => setSelNum(num)}
                        >
                          <span className={s["number-phone"]}>{num.friendly_name}</span>
                          <span className={s["number-meta"]}>
                            {[num.locality, num.region, num.iso_country].filter(Boolean).join(", ")}
                          </span>
                          {num.capabilities && (
                            <div className={s["number-caps"]}>
                              {Object.entries(num.capabilities)
                                .filter(([, v]) => v)
                                .map(([k]) => (
                                  <span key={k} className={`${s["cap-badge"]} ${capClass(k)}`}>
                                    {k}
                                  </span>
                                ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {!searching && available.length === 0 && (
                  <div className={s["empty-state"]}>
                    Search for available Twilio numbers using the filters above.
                  </div>
                )}

                <div className={s.actions} style={{ marginTop: 16 }}>
                  <button className={s["btn-ghost"]} onClick={() => setStep(1)}>
                    ← Back
                  </button>
                  <button className={s["btn-primary"]} onClick={goStep3} disabled={!selNum}>
                    Next → Confirm
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 3 ── */}
            {step === 3 && (
              <>
                <div className={s["confirm-grid"]}>
                  <div className={s["confirm-item"]}>
                    <span className={s["confirm-label"]}>Influencer</span>
                    <span className={s["confirm-value"]}>
                      {inf?.display_name || selInf}
                    </span>
                  </div>
                  <div className={s["confirm-item"]}>
                    <span className={s["confirm-label"]}>Telegram Display Name</span>
                    <span className={s["confirm-value"]}>
                      {firstName}{lastName ? ` ${lastName}` : ""}
                    </span>
                  </div>
                  <div className={s["confirm-item"]}>
                    <span className={s["confirm-label"]}>Phone Number</span>
                    <span className={`${s["confirm-value"]} ${s["confirm-value--mono"]}`}>
                      {selNum?.friendly_name}
                    </span>
                  </div>
                  <div className={s["confirm-item"]}>
                    <span className={s["confirm-label"]}>Location</span>
                    <span className={s["confirm-value"]}>
                      {[selNum?.locality, selNum?.region, selNum?.iso_country].filter(Boolean).join(", ")}
                    </span>
                  </div>
                </div>

                <div className={s.actions}>
                  <button className={s["btn-ghost"]} onClick={() => setStep(2)} disabled={provisioning}>
                    ← Back
                  </button>
                  <button className={s["btn-primary"]} onClick={doProvision} disabled={provisioning}>
                    {provisioning ? (
                      <><span className={s.spinner} /> Provisioning…</>
                    ) : (
                      "🚀 Provision Now"
                    )}
                  </button>
                </div>

                {result && (
                  <div className={`${s["result-banner"]} ${result.ok ? s["result-banner--ok"] : s["result-banner--fail"]}`}>
                    <span className={s["result-title"]}>
                      {result.ok ? "✅ Provisioned successfully" : "❌ Provisioning failed"}
                    </span>
                    <span className={s["result-msg"]}>{result.message}</span>
                    {result.ok && (
                      <button className={s["btn-ghost"]} style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={resetWizard}>
                        Provision Another
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ─────────── PROVISIONED NUMBERS ─────────── */}
        <div className={s.card}>
          <div className={s["card-header"]}>
            <div className={s["card-title"]}>
              <span className={s["card-title-icon"]}>📱</span>
              Provisioned Numbers
            </div>
            <button
              className={`${s["btn-ghost"]} ${s["btn-sm"]}`}
              onClick={loadRows}
              disabled={loadingRows}
            >
              ↺ Refresh
            </button>
          </div>

          {tableErr && <div className={s["error-banner"]}>{tableErr}</div>}

          <div className={s["table-wrap"]}>
            {loadingRows && <div className={s.loading}>Loading…</div>}

            {!loadingRows && rows.length === 0 && !tableErr && (
              <div className={s["empty-state"]}>
                No provisioned numbers yet. Use the wizard above to create one.
              </div>
            )}

            {!loadingRows && rows.length > 0 && (
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Influencer</th>
                    <th>Telegram</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((pn) => (
                    <tr key={pn.id}>
                      <td>
                        <span className={s["table-phone"]}>{pn.phone_number}</span>
                      </td>
                      <td>{pn.influencer_id || "—"}</td>
                      <td>
                        {pn.telegram_first_name || pn.telegram_username || "—"}
                        {pn.telegram_username && (
                          <span style={{ opacity: 0.5, marginLeft: 4, fontSize: 12 }}>
                            @{pn.telegram_username}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`${s.badge} ${badgeColor(pn.telegram_session_status)}`}>
                          <span className={s["badge-dot"]} />
                          {pn.telegram_session_status}
                        </span>
                        {pn.error_message && (
                          <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 3 }}>
                            {pn.error_message}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, opacity: 0.6 }}>
                        {fmtDate(pn.created_at)}
                      </td>
                      <td>
                        <div className={s["table-actions"]}>
                          {(pn.telegram_session_status === "failed" ||
                            pn.telegram_session_status === "error") && (
                            <button
                              className={`${s["btn-ghost"]} ${s["btn-sm"]}`}
                              disabled={rowBusy === pn.id}
                              onClick={() => doRetry(pn.id)}
                            >
                              {rowBusy === pn.id ? "…" : "↺ Retry"}
                            </button>
                          )}
                          <button
                            className={`${s["btn-danger"]} ${s["btn-sm"]}`}
                            disabled={rowBusy === pn.id}
                            onClick={() => doRelease(pn.id)}
                          >
                            {rowBusy === pn.id ? "…" : "Release"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminTelegram;
