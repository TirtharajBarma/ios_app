import { Redirect } from "expo-router";

/**
 * Add subscription route entry point — redirects to service search.
 */
export default function AddIndexScreen() {
  return <Redirect href="/add/search" />;
}
