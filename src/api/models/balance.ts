export interface BalanceResponse {
    balance_cents: number;
}

export interface TopupResponse {
    ok: boolean;
    new_balance_cents: number;
}