# Backend Integration Guide

This guide explains how to use TanStack Query hooks to interact with the backend API.

## Setup

1. **Install dependencies** (if not already installed):
   ```bash
   npm install @tanstack/react-query axios
   ```

2. **Set API Base URL**:
   Add the following to your `.env` file:
   ```
   VITE_API_BASE_URL=http://localhost:3000
   ```
   Or set it to your production API URL.

3. **QueryClientProvider** is already set up in `App.tsx`, so you're ready to use the hooks!

## API Client

The API client uses **axios** with the following features:
- **Automatic authentication**: Firebase ID tokens are automatically added to all requests
- **Request interceptors**: Automatically attach Bearer tokens
- **Response interceptors**: Handle errors and transform responses
- **Type-safe**: Full TypeScript support
- **Error handling**: Comprehensive error handling with descriptive messages

## Authentication

The API client automatically handles Firebase authentication by:
- Getting the current user's Firebase ID token
- Adding it as a Bearer token in the Authorization header
- All requests are automatically authenticated

## Available Hooks

### Auth Hooks (`useAuth.ts`)

```typescript
import { useAuthUser, useSyncAuth } from './hooks/api';

// Get current authenticated user
const { data: user, isLoading } = useAuthUser();

// Sync Firebase user with backend
const syncAuth = useSyncAuth();
await syncAuth.mutateAsync();
```

### User Hooks (`useUsers.ts`)

```typescript
import { useUser, useUpdateUserPreferences, useReferralCode } from './hooks/api';

// Get current user
const { data: user } = useUser();

// Update user preferences
const updatePreferences = useUpdateUserPreferences();
await updatePreferences.mutateAsync({ currency: 'USD', theme: 'dark' });

// Get referral code
const { data: referralCode } = useReferralCode();
```

### Household Hooks (`useHouseholds.ts`)

```typescript
import { 
  useHouseholds, 
  useHousehold, 
  useCreateHousehold,
  useInviteMember 
} from './hooks/api';

// List all households
const { data: households } = useHouseholds();

// Get specific household
const { data: household } = useHousehold(householdId);

// Create household
const createHousehold = useCreateHousehold();
await createHousehold.mutateAsync({ name: 'My Household' });

// Invite member
const inviteMember = useInviteMember();
await inviteMember.mutateAsync({ 
  householdId, 
  email: 'user@example.com', 
  role: 'editor' 
});
```

### Account Hooks (`useAccounts.ts`)

```typescript
import { 
  useAccounts, 
  useCreateAccount, 
  useUpdateAccount,
  useTransferBetweenAccounts 
} from './hooks/api';

// List accounts
const { data: accounts } = useAccounts({ householdId });

// Create account
const createAccount = useCreateAccount();
await createAccount.mutateAsync({
  householdId,
  name: 'Checking Account',
  type: 'checking',
  balance: 1000
});

// Transfer between accounts
const transfer = useTransferBetweenAccounts();
await transfer.mutateAsync({
  fromAccountId: 'acc1',
  toAccountId: 'acc2',
  amount: 100,
  description: 'Transfer'
});
```

### Transaction Hooks (`useTransactions.ts`)

```typescript
import { 
  useTransactions, 
  useCreateTransaction,
  useTransactionSummary,
  useSpendingByCategory 
} from './hooks/api';

// List transactions
const { data: transactions } = useTransactions({
  householdId,
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  type: 'expense'
});

// Create transaction
const createTransaction = useCreateTransaction();
await createTransaction.mutateAsync({
  householdId,
  description: 'Groceries',
  amount: 50,
  type: 'expense',
  categoryId: 'cat1',
  accountId: 'acc1',
  date: '2024-01-15',
  paid: true
});

// Get summary
const { data: summary } = useTransactionSummary({
  householdId,
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

// Get spending by category
const { data: spending } = useSpendingByCategory({
  householdId,
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
```

### Category Hooks (`useCategories.ts`)

```typescript
import { 
  useCategories, 
  useCreateCategory,
  useCategoryStats 
} from './hooks/api';

// List categories
const { data: categories } = useCategories({ householdId, type: 'expense' });

// Create category
const createCategory = useCreateCategory();
await createCategory.mutateAsync({
  householdId,
  name: 'Food',
  type: 'expense',
  color: '#FF5733'
});

// Get category stats
const { data: stats } = useCategoryStats(categoryId);
```

### Budget Hooks (`useBudgets.ts`)

```typescript
import { 
  useBudgets, 
  useCreateBudget,
  useBudgetSummary 
} from './hooks/api';

// List budgets
const { data: budgets } = useBudgets({
  householdId,
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});

// Create budget
const createBudget = useCreateBudget();
await createBudget.mutateAsync({
  householdId,
  categoryId: 'cat1',
  amount: 500,
  period: {
    start: '2024-01-01',
    end: '2024-01-31'
  }
});

// Get budget summary
const { data: summary } = useBudgetSummary({
  householdId,
  startDate: '2024-01-01',
  endDate: '2024-01-31'
});
```

### Savings Goals Hooks (`useSavingsGoals.ts`)

```typescript
import { 
  useSavingsGoals, 
  useCreateSavingsGoal,
  useAddToSavingsGoal 
} from './hooks/api';

// List savings goals
const { data: goals } = useSavingsGoals({ householdId });

// Create savings goal
const createGoal = useCreateSavingsGoal();
await createGoal.mutateAsync({
  householdId,
  name: 'Vacation',
  targetAmount: 5000,
  targetDate: '2024-12-31'
});

// Add to savings goal
const addToGoal = useAddToSavingsGoal();
await addToGoal.mutateAsync({
  goalId: 'goal1',
  amount: 100,
  description: 'Monthly savings'
});
```

### Recurring Transactions Hooks (`useRecurringTransactions.ts`)

```typescript
import { 
  useRecurringTransactions,
  useDueRecurringTransactions,
  useCreateRecurringTransaction,
  useExecuteRecurringTransaction 
} from './hooks/api';

// List recurring transactions
const { data: recurring } = useRecurringTransactions({
  householdId,
  isActive: true
});

// Get due recurring transactions
const { data: due } = useDueRecurringTransactions(householdId);

// Create recurring transaction
const createRecurring = useCreateRecurringTransaction();
await createRecurring.mutateAsync({
  householdId,
  description: 'Rent',
  amount: 1000,
  type: 'expense',
  categoryId: 'cat1',
  accountId: 'acc1',
  frequency: 'monthly',
  startDate: '2024-01-01'
});

// Execute recurring transaction
const execute = useExecuteRecurringTransaction();
await execute.mutateAsync({ recurringId: 'rec1' });
```

## Error Handling

All hooks use TanStack Query's built-in error handling:

```typescript
const { data, error, isLoading } = useTransactions({ householdId });

if (error) {
  console.error('Error fetching transactions:', error);
}
```

## Cache Invalidation

Mutations automatically invalidate related queries. For example, when you create a transaction:
- `transactions` queries are invalidated
- `transactions/summary` queries are invalidated
- `accounts` queries are invalidated (balance changes)

You can also manually invalidate queries:

```typescript
import { queryClient } from './lib/queryClient';

queryClient.invalidateQueries({ queryKey: ['transactions'] });
```

## TypeScript Types

All hooks are fully typed. Import types from the hook files:

```typescript
import type { Transaction, Account, Budget } from './hooks/api/useTransactions';
```

## Notes

- All API requests require authentication (Firebase ID token)
- Most operations require a `householdId` parameter
- Mutations return the created/updated resource
- Queries are automatically cached and refetched when needed
- The API client (axios) handles date serialization automatically
- Axios interceptors automatically add authentication tokens to all requests
- Network errors and API errors are properly handled and thrown as Error objects
- 204 No Content responses are handled gracefully

## Advanced Usage

You can also use the axios instance directly if needed:

```typescript
import { axiosInstance } from './utils/api';

// Custom request with axios
const response = await axiosInstance.get('/custom-endpoint', {
  params: { custom: 'value' }
});
```

