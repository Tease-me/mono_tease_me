import { lazy } from "react";


export default {
    Ai: lazy(() => import("@/assets/mj-dashboard/svg/Ai.svg?react")),
    ArrowRight: lazy(() => import("@/assets/mj-dashboard/svg/ArrowRight.svg?react")),
    Bill: lazy(() => import("@/assets/mj-dashboard/svg/Bill.svg?react")),
    Chat: lazy(() => import("@/assets/mj-dashboard/svg/Chat.svg?react")),
    Danger: lazy(() => import("@/assets/mj-dashboard/svg/DangerTriangle.svg?react")),
    Dashboard: lazy(() => import("@/assets/mj-dashboard/svg/dashboard.svg?react")),
    Logout: lazy(() => import("@/assets/mj-dashboard/svg/Logout.svg?react")),
    Profile: lazy(() => import("@/assets/mj-dashboard/svg/Profile.svg?react")),
    Users: lazy(() => import("@/assets/mj-dashboard/svg/Users.svg?react")),
}