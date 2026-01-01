import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
    index("routes/home.tsx"),
    route('convert', 'routes/convert.tsx'),
] satisfies RouteConfig;
