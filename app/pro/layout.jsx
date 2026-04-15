import styles from "./layout.module.css";

export default function ProLayout({ children }) {
  return <div className={styles.shell}>{children}</div>;
}
