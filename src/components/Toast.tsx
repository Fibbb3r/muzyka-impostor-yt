import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';

interface Props {
  message: string | null;
  onDone: () => void;
}

export default function Toast({ message, onDone }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [message, onDone]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          className="toast"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22 }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
