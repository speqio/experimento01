export const CHECKOUT = /* GraphQL */ `
  mutation Checkout($input: CheckoutInput!) {
    checkout(input: $input) {
      order {
        id
        databaseId
        orderNumber
        total
        needsPayment
      }
      result
      redirect
    }
  }
`;
