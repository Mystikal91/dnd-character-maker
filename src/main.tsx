import { render } from "preact";
import { App } from "./ui/App";
import "./ui/print/print.css";
import "./ui/styles.css";

const root = document.getElementById("app");
if (root) render(<App />, root);
