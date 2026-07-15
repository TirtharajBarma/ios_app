// Type declaration so TypeScript understands CSS imports.
declare module "*.css" {
  const content: string;
  export default content;
}
