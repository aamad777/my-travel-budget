const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const TOKEN_KEY = "travel_budget_token";

export type LocalUser = {
  id: string;
  email: string;
  created_at?: string;
  display_name?: string | null;
  default_currency?: string | null;
};

export type Trip = {
  id: string;
  user_id: string;
  name: string;
  destination: string | null;
  currency: string;
  budget_amount: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
};

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

    if (!response.ok) {
    const details = data.error || data.message || JSON.stringify(data) || "No response body";
    throw new Error(`API ${response.status} ${response.statusText}: ${details}`);
  }

  return data as T;
}

export const authApi = {
  async signup(input: {
    email: string;
    password: string;
    displayName?: string;
  }) {
    const data = await apiRequest<{ user: LocalUser; token: string }>(
      "/auth/signup",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );

    setToken(data.token);
    return data;
  },

  async login(input: { email: string; password: string }) {
    const data = await apiRequest<{ user: LocalUser; token: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );

    setToken(data.token);
    return data;
  },

  async me() {
    return apiRequest<{ user: LocalUser }>("/auth/me");
  },

  logout() {
    clearToken();
  },
};

export const tripsApi = {
  async list() {
    return apiRequest<{ trips: Trip[] }>("/trips");
  },

  async getById(id: string) {
    return apiRequest<{ trip: Trip }>(`/trips/${id}`);
  },

  async create(input: {
    name: string;
    destination?: string | null;
    currency: string;
    budget_amount: number;
    start_date?: string | null;
    end_date?: string | null;
  }) {
    return apiRequest<{ trip: Trip }>("/trips", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
};
export type ExpenseItem = {
  id: string;
  user_id: string;
  expense_id: string;
  description: string | null;
  amount: number;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  trip_id: string;
  category_id: string | null;
  amount: number;
  currency: string;
  fx_rate_to_trip: number;
  amount_in_trip_currency: number;
  kind: "expense" | "income";
  note: string | null;
  spent_at: string;
  created_at: string;
  expense_items: ExpenseItem[];
};

export const expensesApi = {
  async list(tripId: string) {
    return apiRequest<{ expenses: Expense[] }>(`/trips/${tripId}/expenses`);
  },

  async create(
    tripId: string,
    input: {
      amount: number;
      currency: string;
      fx_rate_to_trip: number;
      amount_in_trip_currency: number;
      category_id?: string | null;
      note?: string | null;
      spent_at?: string | null;
      kind: "expense" | "income";
      items?: Array<{
        description?: string | null;
        amount?: number;
      }>;
    }
  ) {
    return apiRequest<{ expense: Expense }>(`/trips/${tripId}/expenses`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async delete(id: string) {
    return apiRequest<{ deleted: boolean }>(`/expenses/${id}`, {
      method: "DELETE",
    });
  },

  async addItem(
    expenseId: string,
    input: {
      description?: string | null;
      amount?: number;
    }
  ) {
    return apiRequest<{ item: ExpenseItem }>(`/expenses/${expenseId}/items`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async deleteItem(id: string) {
    return apiRequest<{ deleted: boolean }>(`/expense-items/${id}`, {
      method: "DELETE",
    });
  },
};