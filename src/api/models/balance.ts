interface BalanceResponse {
    balance_cents: number;
}

interface TopupResponse {
    ok: boolean;
    new_balance_cents: number;
}