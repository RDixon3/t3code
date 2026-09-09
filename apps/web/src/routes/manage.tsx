import { createFileRoute } from "@tanstack/react-router";
import { ManageLanding } from "../components/workspace/ManageLanding";

export const Route = createFileRoute("/manage")({
  component: ManageLanding,
});
