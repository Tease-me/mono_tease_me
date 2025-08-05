interface BalanceResponse {
    balance_cents: string;
}

interface TopupResponse {
    ok: boolean;
    new_balance_cents: number;
}