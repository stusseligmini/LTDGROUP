import toast from 'react-hot-toast';

export const toastUtils = {
  success: (message: string) => {
    return toast.success(message);
  },
  
  error: (message: string) => {
    return toast.error(message);
  },
  
  loading: (message: string) => {
    return toast.loading(message);
  },
  
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string;
      error: string;
    }
  ) => {
    return toast.promise(promise, messages);
  },
  
  txSuccess: (signature: string) => {
    return toast.success(
      `Transaction successful! Signature: ${signature.slice(0, 8)}...`,
      { duration: 6000 }
    );
  },
  
  copied: () => {
    return toast.success('Copied to clipboard!', { duration: 2000 });
  },
  
  dismiss: (toastId?: string) => {
    return toast.dismiss(toastId);
  },
};

export default toastUtils;
