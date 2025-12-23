// Type declarations for packages without @types

declare module 'axios' {
  const axios: any;
  export default axios;
}

declare module '@walletconnect/types' {
  export const SessionTypes: any;
  export const ProposalTypes: any;
}

declare module '@walletconnect/core' {
  export const Core: any;
}

declare module '@walletconnect/web3wallet' {
  export const Web3Wallet: any;
}

declare module 'node-cron' {
  const cron: any;
  export = cron;
}

declare module 'trezor-connect' {
  const TrezorConnect: any;
  export default TrezorConnect;
}

declare module '@ledgerhq/hw-transport-webusb' {
  const TransportWebUSB: any;
  export default TransportWebUSB;
}

declare module '@ledgerhq/hw-app-eth' {
  const Eth: any;
  export default Eth;
}

declare module '@ledgerhq/hw-app-solana' {
  const Solana: any;
  export default Solana;
}
