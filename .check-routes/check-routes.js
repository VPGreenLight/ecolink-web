import { C as signIn, O as useSession, T as syncSessionState, c as rotateRefreshTokenSingleFlight, d as ROLE_LABEL, f as getAccessToken, g as hasLiveBackendAuth, h as getSession, i as ensureActiveAuthSession, m as getRefreshToken, n as apiRequest, o as getResolvedApiHost, u as ROLE_HOME, v as isRealJwt, w as signOut, y as isStoredAccessTokenExpired } from "./assets/api-EEdo2tj_.js";
import { r as isSsrSmokeTest } from "./assets/hydration-DFDh5R3l.js";
import { r as openAuthPopup } from "./assets/popupAuth-BBAIKi8j.js";
import { _ as useEntitlements } from "./assets/servicePackageApi-W2U1_X2o.js";
import { t as ConfirmLogoutDialog } from "./assets/ConfirmLogoutDialog-BCtW4PUy.js";
import { t as UserAvatar } from "./assets/UserAvatar-Dhp9LzfI.js";
import { m as fetchMyVirtualTree } from "./assets/gamificationApi-BAUfIACF.js";
import { c as getTreeAvatarImgClass, d as saveLiveTreePreview, i as getDefaultFrameForStage, l as readLiveTreePreview, o as getFrameSrc, r as clearLiveTreePreview, s as getStageName, u as readStoredTreePreview } from "./assets/virtualTree-mfjB_c6E.js";
import { a as fetchCurrentUserProfile } from "./assets/authApi-Ck5l83tX.js";
import { renderToStaticMarkup } from "react-dom/server";
import { Link, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import * as signalR from "@microsoft/signalr";
import { BookOpen, Gift, Home, MapPin, MessageSquare, ScanLine, X } from "lucide-react";
//#region src/components/AuthLayout.tsx
/** Khung trang riêng cho Đăng nhập / Đăng ký.
*
*  Màn rộng (popup được phóng to): hai cột - panel thương hiệu dùng ảnh mầm cây
*  bên trái, form bên phải. Màn hẹp / popup mặc định 480px: chỉ còn form trên
*  nền sáng có quầng xanh nhẹ. */
var HIGHLIGHTS = [
	"Kết nối cơ sở thu mua gần bạn",
	"Điểm danh hằng ngày và chăm cây tích Điểm Xanh",
	"Theo dõi cây ảo và phần thưởng"
];
function AuthLayout() {
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-page lg:grid lg:grid-cols-2",
		children: [/* @__PURE__ */ jsxs("aside", {
			className: "relative hidden overflow-hidden bg-[#06120b] lg:block",
			children: [
				/* @__PURE__ */ jsx("img", {
					src: "/assets/auth/leaves.jpg",
					alt: "",
					"aria-hidden": "true",
					className: "absolute inset-0 h-full w-full object-cover"
				}),
				/* @__PURE__ */ jsx("div", {
					"aria-hidden": "true",
					className: "absolute inset-0 bg-[#06120b]/35"
				}),
				/* @__PURE__ */ jsx("div", {
					"aria-hidden": "true",
					className: "absolute inset-x-0 bottom-0 h-[64%] bg-gradient-to-t from-[#06120b] via-[#06120b]/80 to-transparent"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "relative flex h-full min-h-dvh flex-col p-10 xl:p-14",
					children: [
						/* @__PURE__ */ jsx(Link, {
							to: "/",
							"aria-label": "EcoLink - Trang chủ",
							className: "inline-flex w-fit items-center rounded-2xl bg-white/95 px-4 py-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)] backdrop-blur-sm",
							children: /* @__PURE__ */ jsx("img", {
								src: "/assets/brand/logo1.png",
								alt: "EcoLink",
								className: "h-8 w-auto"
							})
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-auto max-w-[30rem] pt-16",
							children: [
								/* @__PURE__ */ jsxs("p", {
									className: "text-[2rem] leading-[1.12] font-bold tracking-tight text-white xl:text-[2.5rem]",
									children: [
										"Gieo một mầm xanh,",
										/* @__PURE__ */ jsx("br", {}),
										"lớn lên cùng cộng đồng."
									]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-4 max-w-[26rem] text-[15px] leading-relaxed text-white/80",
									children: "Theo dõi lịch thu gom minh bạch, điểm danh tích thưởng và nuôi dưỡng cây ảo của riêng bạn."
								}),
								/* @__PURE__ */ jsx("ul", {
									className: "mt-8 grid gap-3",
									children: HIGHLIGHTS.map((item) => /* @__PURE__ */ jsxs("li", {
										className: "flex items-start gap-3",
										children: [/* @__PURE__ */ jsx("span", {
											className: "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-white/12 ring-1 ring-white/25",
											children: /* @__PURE__ */ jsx("svg", {
												viewBox: "0 0 16 16",
												fill: "none",
												"aria-hidden": "true",
												className: "size-3.5 text-mint",
												children: /* @__PURE__ */ jsx("path", {
													d: "m3.5 8.5 3 3 6-7",
													stroke: "currentColor",
													strokeWidth: "1.9",
													strokeLinecap: "round",
													strokeLinejoin: "round"
												})
											})
										}), /* @__PURE__ */ jsx("span", {
											className: "text-sm leading-6 text-white/85",
											children: item
										})]
									}, item))
								})
							]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "mt-10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/55",
							children: [
								/* @__PURE__ */ jsx("span", { children: "© 2026 EcoLink" }),
								/* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									className: "size-1 rounded-full bg-white/40"
								}),
								/* @__PURE__ */ jsx("span", { children: "Nền tảng thu gom tuần hoàn" })
							]
						})
					]
				})
			]
		}), /* @__PURE__ */ jsxs("main", {
			className: "relative flex min-h-dvh flex-col justify-center overflow-hidden px-5 py-10 sm:px-8",
			children: [/* @__PURE__ */ jsx("div", {
				"aria-hidden": "true",
				className: "pointer-events-none absolute inset-0 bg-[radial-gradient(760px_460px_at_50%_-10%,#dcefe3_0%,rgba(247,251,248,0)_72%)]"
			}), /* @__PURE__ */ jsx("div", {
				className: "relative mx-auto w-full max-w-[420px]",
				children: /* @__PURE__ */ jsx(Suspense, {
					fallback: null,
					children: /* @__PURE__ */ jsx(Outlet, {})
				})
			})]
		})]
	});
}
//#endregion
//#region src/lib/notificationsApi.ts
/** [STT 169] Lấy danh sách thông báo hệ thống & bộ đếm chưa đọc (GET /api/v1/notifications). */
async function fetchMyNotifications(params) {
	const qs = new URLSearchParams();
	if (typeof params?.isRead === "boolean") qs.set("isRead", String(params.isRead));
	if (params?.notificationType) qs.set("notificationType", params.notificationType);
	qs.set("pageNumber", String(params?.pageNumber ?? 1));
	qs.set("pageSize", String(params?.pageSize ?? 20));
	return apiRequest(`/api/v1/notifications?${qs.toString()}`, { method: "GET" });
}
var NOTIFICATIONS_UPDATED_EVENT = "ecolink:notifications-updated";
function emitNotificationsUpdated(detail) {
	if (typeof window === "undefined") return;
	window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail }));
}
/** [STT 170] Đánh dấu một thông báo là đã đọc (PATCH /api/v1/notifications/{notificationId}/read). */
async function markNotificationRead(notificationId) {
	const res = await apiRequest(`/api/v1/notifications/${notificationId}/read`, { method: "PATCH" });
	if (res.success) emitNotificationsUpdated({ delta: -1 });
	return res;
}
/** [STT 171] Đánh dấu toàn bộ thông báo chưa đọc của tài khoản là đã xem (PUT /api/v1/notifications/read-all). */
async function markAllNotificationsRead() {
	const res = await apiRequest("/api/v1/notifications/read-all", { method: "PUT" });
	if (res.success) emitNotificationsUpdated({ unreadCount: 0 });
	return res;
}
async function resolveSignalRToken() {
	let token = getAccessToken();
	if (token && !isRealJwt(token) && getRefreshToken()) token = await rotateRefreshTokenSingleFlight();
	else if (token && isRealJwt(token) && isStoredAccessTokenExpired(10) && getRefreshToken()) token = await rotateRefreshTokenSingleFlight();
	return isRealJwt(token) ? token : "";
}
/**
* [STT 172] Kết nối SignalR Real-Time Notification Hub (`/hubs/notifications`).
* Trả về `null` khi chạy trên SSR Node.js.
*/
function createNotificationHubConnection(handlers) {
	if (typeof window === "undefined") return null;
	const resolvedBase = "".trim().replace(/\/+$/, "") || getResolvedApiHost();
	const hubUrl = resolvedBase ? `${resolvedBase}/hubs/notifications` : "/hubs/notifications";
	const connection = new signalR.HubConnectionBuilder().withUrl(hubUrl, {
		accessTokenFactory: resolveSignalRToken,
		transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling
	}).withAutomaticReconnect([
		0,
		2e3,
		5e3,
		1e4
	]).configureLogging(signalR.LogLevel.Warning).build();
	if (handlers.onReceiveNotification) connection.on("ReceiveNotification", handlers.onReceiveNotification);
	if (handlers.onUnreadCountUpdated) connection.on("UnreadCountUpdated", handlers.onUnreadCountUpdated);
	return connection;
}
//#endregion
//#region src/data/nav.ts
var NAV_LINKS = [
	{
		to: "/",
		label: "Tổng quan"
	},
	{
		to: "/scanner",
		label: "AI phân loại rác",
		mobileLabel: "AI phân loại"
	},
	{
		to: "/map",
		label: "Điểm thu mua"
	},
	{
		to: "/rewards",
		label: "Đổi thưởng"
	},
	{
		to: "/blog",
		label: "Blog"
	}
];
var FOOTER_COLUMNS = [{
	title: "HỆ SINH THÁI",
	links: [
		{
			label: "Nhận diện tự động qua Camera",
			to: "/scanner"
		},
		{
			label: "Sàn giao dịch phế liệu GPS",
			to: "/map"
		},
		"Chứng chỉ tín chỉ tuần hoàn EPR"
	]
}, {
	title: "CỘNG ĐỒNG & PHÁP LÝ",
	links: [
		{
			label: "Khiếu nại và góp ý",
			to: "/feedback"
		},
		{
			label: "Hướng dẫn phân loại rác nguồn",
			to: "/guidance"
		},
		{
			label: "Tra cứu & Quy chuẩn vật liệu",
			to: "/waste"
		},
		{
			label: "Chính sách quyền riêng tư",
			to: "/terms?category=PRIVACY"
		},
		{
			label: "Điều khoản dịch vụ môi trường",
			to: "/terms"
		}
	]
}];
var SUPPORT = {
	title: "TRUNG TÂM HỖ TRỢ",
	note: "Đường dây nóng điều phối thu gom và xử lý sự cố chất thải địa phương.",
	links: ["1900 8828 (8:00 - 18:00)", "hotro@ecolink.vn"]
};
//#endregion
//#region src/components/Navbar.tsx
function Chevron({ open }) {
	return /* @__PURE__ */ jsx("svg", {
		viewBox: "0 0 16 16",
		fill: "none",
		"aria-hidden": "true",
		className: `size-3.5 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`,
		children: /* @__PURE__ */ jsx("path", {
			d: "m4 6 4 4 4-4",
			stroke: "currentColor",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
/** Menu tài khoản: các mục dùng chung cho cả 4 vai trò sau đăng nhập. */
var ACCOUNT_ITEMS$1 = [{
	to: "/account/profile",
	label: "Hồ sơ cá nhân",
	icon: /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		className: "size-4 text-muted",
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "8",
			r: "4"
		}), /* @__PURE__ */ jsx("path", { d: "M20 21a8 8 0 1 0-16 0" })]
	})
}, {
	to: "/account/password",
	label: "Đổi mật khẩu",
	icon: /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		className: "size-4 text-muted",
		children: [/* @__PURE__ */ jsx("rect", {
			width: "18",
			height: "11",
			x: "3",
			y: "11",
			rx: "2",
			ry: "2"
		}), /* @__PURE__ */ jsx("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" })]
	})
}];
/** Mục Khám phá: dùng lại cho cả khách và người đã đăng nhập. `register` chỉ
*  hiện khi đã đăng nhập — U-05 là bước nâng cấp từ tài khoản người dân lên
*  cơ sở thu mua, người chưa có tài khoản thì chưa ở trong hệ sinh thái. */
var EXPLORE = [["/feedback", "Khiếu nại và góp ý"], ["/leaderboard", "Xếp hạng người dùng"]];
function ExploreList({ close, withRegister }) {
	const items = withRegister ? [...EXPLORE, ["/join-recycler", "Đăng ký cơ sở thu mua"]] : EXPLORE;
	return /* @__PURE__ */ jsxs("div", {
		className: "p-2 space-y-0.5",
		children: [/* @__PURE__ */ jsx("p", {
			className: "px-3.5 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase",
			children: "Khám phá"
		}), /* @__PURE__ */ jsx("div", {
			className: "space-y-0.5",
			children: items.map(([to, label]) => /* @__PURE__ */ jsxs(Link, {
				to,
				onClick: close,
				className: "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
				children: [label, /* @__PURE__ */ jsx("svg", {
					viewBox: "0 0 16 16",
					fill: "none",
					"aria-hidden": "true",
					className: "size-4 text-muted",
					children: /* @__PURE__ */ jsx("path", {
						d: "m6 4 4 4-4 4",
						stroke: "currentColor",
						strokeWidth: "1.8",
						strokeLinecap: "round",
						strokeLinejoin: "round"
					})
				})]
			}, to))
		})]
	});
}
function AccountMenu$1() {
	const session = useSession();
	const entitlements = useEntitlements();
	const user = session?.name ?? "";
	const navigate = useNavigate();
	const [open, setOpen] = useState(false);
	const [confirmLogout, setConfirmLogout] = useState(false);
	const ref = useRef(null);
	useEffect(() => {
		if (!open) return;
		const onDocClick = (e) => {
			if (!ref.current?.contains(e.target)) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	const logout = () => {
		setOpen(false);
		setConfirmLogout(true);
	};
	const handleConfirmLogout = () => {
		signOut();
		setConfirmLogout(false);
		navigate("/");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "sm:relative",
		ref,
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				"aria-label": user ? `Tài khoản: ${user}` : "Đăng nhập hoặc đăng ký",
				"aria-haspopup": "menu",
				"aria-expanded": open,
				onClick: () => setOpen((v) => !v),
				className: "flex h-10 items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-1 shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-colors hover:border-sage-line hover:bg-surface-2",
				children: [/* @__PURE__ */ jsx(UserAvatar, {
					name: user,
					avatarUrl: session?.avatarUrl,
					size: "sm"
				}), /* @__PURE__ */ jsx(Chevron, { open })]
			}),
			open && /* @__PURE__ */ jsx("div", {
				role: "menu",
				className: "absolute top-[calc(100%+0.5rem)] right-3 left-3 max-h-[calc(100dvh-5.75rem)] overflow-x-hidden overflow-y-auto overscroll-contain rounded-2xl border border-line bg-white shadow-[0_20px_48px_-10px_rgba(15,31,21,0.18)] sm:top-full sm:right-0 sm:left-auto sm:mt-2.5 sm:w-[360px]",
				children: user ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3.5 border-b border-line-soft bg-surface-2/60 px-4 py-3.5",
						children: [/* @__PURE__ */ jsx(UserAvatar, {
							name: user,
							avatarUrl: session?.avatarUrl,
							size: "md"
						}), /* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate text-base font-bold text-ink",
								children: user
							}), /* @__PURE__ */ jsx("p", {
								className: "text-xs text-muted",
								children: ROLE_LABEL[session.role]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "p-2 space-y-0.5",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "px-3.5 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase",
								children: "Trang cá nhân"
							}),
							ACCOUNT_ITEMS$1.map((item) => /* @__PURE__ */ jsxs(Link, {
								to: item.to,
								onClick: () => setOpen(false),
								className: "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: [item.icon, item.label]
							}, item.to)),
							session.role === "user" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Link, {
								to: "/user/transactions",
								onClick: () => setOpen(false),
								className: "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: [/* @__PURE__ */ jsxs("svg", {
									viewBox: "0 0 24 24",
									fill: "none",
									stroke: "currentColor",
									strokeWidth: "1.8",
									strokeLinecap: "round",
									strokeLinejoin: "round",
									"aria-hidden": "true",
									className: "size-4 text-muted",
									children: [/* @__PURE__ */ jsx("path", { d: "M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" }), /* @__PURE__ */ jsx("path", { d: "M8 7h8M8 11h8M8 15h5" })]
								}), "Lịch sử biên nhận"]
							}), /* @__PURE__ */ jsxs(Link, {
								to: "/user/payout#citizen-packages",
								onClick: () => setOpen(false),
								className: "flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ jsxs("svg", {
										viewBox: "0 0 24 24",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "1.8",
										strokeLinecap: "round",
										strokeLinejoin: "round",
										"aria-hidden": "true",
										className: "size-4 text-muted",
										children: [/* @__PURE__ */ jsx("path", { d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" }), /* @__PURE__ */ jsx("path", { d: "M5 21h14" })]
									}), "Gói dịch vụ"]
								}), /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-bold text-brand-deep",
									children: entitlements.currentTier
								})]
							})] }),
							session.role === "recycler" && /* @__PURE__ */ jsxs(Link, {
								to: "/recycler/packages",
								onClick: () => setOpen(false),
								className: "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "flex items-center gap-3",
									children: [/* @__PURE__ */ jsxs("svg", {
										viewBox: "0 0 24 24",
										fill: "none",
										stroke: "currentColor",
										strokeWidth: "1.8",
										strokeLinecap: "round",
										strokeLinejoin: "round",
										"aria-hidden": "true",
										className: "size-4 text-muted",
										children: [/* @__PURE__ */ jsx("path", { d: "M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" }), /* @__PURE__ */ jsx("path", { d: "M5 21h14" })]
									}), "Gói dịch vụ"]
								}), /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800",
									children: entitlements.currentTier
								})]
							}),
							session.role !== "user" && /* @__PURE__ */ jsxs(Link, {
								to: ROLE_HOME[session.role],
								onClick: () => setOpen(false),
								className: "flex items-center justify-between rounded-xl bg-brand/10 px-3.5 py-2.5 text-sm font-semibold text-brand-deep transition-colors hover:bg-brand/16",
								children: [
									"Khu vực ",
									ROLE_LABEL[session.role].toLowerCase(),
									/* @__PURE__ */ jsx("svg", {
										viewBox: "0 0 16 16",
										fill: "none",
										"aria-hidden": "true",
										className: "size-4 text-muted",
										children: /* @__PURE__ */ jsx("path", {
											d: "m6 4 4 4-4 4",
											stroke: "currentColor",
											strokeWidth: "1.8",
											strokeLinecap: "round",
											strokeLinejoin: "round"
										})
									})
								]
							})
						]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "border-t border-line-soft",
						children: /* @__PURE__ */ jsx(ExploreList, {
							close: () => setOpen(false),
							withRegister: session?.role === "user"
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "border-t border-line-soft p-2 space-y-0.5",
						children: [/* @__PURE__ */ jsx("p", {
							className: "px-3.5 pt-2 pb-1 text-xs font-semibold tracking-[0.08em] text-muted uppercase",
							children: "Khác"
						}), /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: logout,
							className: "flex w-full items-center gap-3 rounded-xl bg-white px-3.5 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50",
							children: [/* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 24 24",
								fill: "none",
								"aria-hidden": "true",
								className: "size-4 text-red-600",
								children: /* @__PURE__ */ jsx("path", {
									d: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9",
									stroke: "currentColor",
									strokeWidth: "2",
									strokeLinecap: "round",
									strokeLinejoin: "round"
								})
							}), "Đăng xuất"]
						})]
					})
				] }) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("div", {
					className: "border-b border-line-soft p-4",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-base font-bold text-ink",
							children: "Chào mừng đến EcoLink"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs text-muted",
							children: "Đăng nhập để theo dõi lịch thu gom"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-3.5 grid grid-cols-2 gap-2.5",
							children: [/* @__PURE__ */ jsx("a", {
								href: "/register",
								onClick: (e) => {
									e.preventDefault();
									setOpen(false);
									openAuthPopup("register");
								},
								className: "grid h-10 place-items-center rounded-xl border border-brand/30 bg-brand/10 text-sm font-semibold text-brand transition-[background-color,transform] duration-200 ease-out hover:bg-brand/18 hover:border-brand/50 active:scale-[0.97]",
								children: "Tạo tài khoản"
							}), /* @__PURE__ */ jsx("a", {
								href: "/login",
								onClick: (e) => {
									e.preventDefault();
									setOpen(false);
									openAuthPopup("login");
								},
								className: "grid h-10 place-items-center rounded-xl bg-brand text-sm font-semibold text-white transition-[background-color,transform] duration-200 ease-out hover:bg-brand-deep active:scale-[0.97]",
								children: "Đăng nhập"
							})]
						})
					]
				}), /* @__PURE__ */ jsx(ExploreList, {
					close: () => setOpen(false),
					withRegister: false
				})] })
			}),
			/* @__PURE__ */ jsx(ConfirmLogoutDialog, {
				open: confirmLogout,
				onClose: () => setConfirmLogout(false),
				onConfirm: handleConfirmLogout,
				userName: user
			})
		]
	});
}
function Navbar() {
	const session = useSession();
	return /* @__PURE__ */ jsx("header", {
		className: "fixed inset-x-0 top-0 z-50 h-[70px] border-b border-sage/25 bg-white/95 shadow-[0_4px_22px_rgba(15,31,21,0.06)] backdrop-blur-xl md:h-[76px]",
		children: /* @__PURE__ */ jsxs("div", {
			className: "page flex h-full items-center gap-6 lg:gap-8",
			children: [
				/* @__PURE__ */ jsx(Link, {
					to: "/",
					"aria-label": "EcoLink - Trang chủ",
					className: "shrink-0",
					children: /* @__PURE__ */ jsx("img", {
						src: "/assets/brand/logo1.png",
						alt: "EcoLink",
						className: "h-[42px] w-auto md:h-[46px]"
					})
				}),
				/* @__PURE__ */ jsx("nav", {
					"aria-label": "Điều hướng chính",
					className: "hidden items-center gap-1 lg:flex",
					children: NAV_LINKS.map((link) => /* @__PURE__ */ jsx(NavLink, {
						to: link.to,
						end: link.to === "/",
						className: ({ isActive }) => `relative px-3 py-2 text-sm whitespace-nowrap transition-colors after:absolute after:right-3 after:bottom-0 after:left-3 after:h-[2px] after:rounded-full after:bg-brand after:transition-transform ${isActive ? "font-semibold text-brand-deep after:scale-x-100" : "font-medium text-body after:scale-x-0 hover:text-brand-deep hover:after:scale-x-100"}`,
						children: link.label
					}, link.to))
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "ml-auto flex items-center gap-2 sm:gap-3",
					children: [
						!session && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => openAuthPopup("login"),
							className: "hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep sm:inline-flex",
							children: "Đăng nhập"
						}),
						session && (session.role === "user" || session.role === "recycler") && /* @__PURE__ */ jsx(NavLink, {
							to: "/chat",
							title: "Chatbox thương lượng",
							"aria-label": "Chatbox thương lượng",
							className: ({ isActive }) => `group relative flex size-10 items-center justify-center rounded-full border shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-[color,border-color,background-color,transform] duration-200 ease-out active:scale-[0.96] ${isActive ? "border-brand/35 bg-brand/10 text-brand-deep" : "border-line bg-white text-muted hover:border-sage-line hover:bg-surface-2 hover:text-ink"}`,
							children: /* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 24 24",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.8",
								strokeLinecap: "round",
								strokeLinejoin: "round",
								"aria-hidden": "true",
								className: "size-[18px] transition-transform duration-200 group-hover:scale-105",
								children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" })
							})
						}),
						session && /* @__PURE__ */ jsx(NotificationBellMenu, { isLoggedIn: Boolean(session) }),
						/* @__PURE__ */ jsx(AccountMenu$1, {})
					]
				})
			]
		})
	});
}
var FALLBACK_NOTES = [
	{
		id: "n1",
		title: "Lịch thu gom đã được xác nhận",
		message: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
		time: "Hôm nay, 09:34",
		isRead: false,
		isBackend: false
	},
	{
		id: "n2",
		title: "Biên nhận hoàn tất",
		message: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
		time: "Hôm nay, 11:02",
		isRead: false,
		isBackend: false
	},
	{
		id: "n3",
		title: "Nhắc nhở điểm danh",
		message: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
		time: "Hôm qua, 20:00",
		isRead: true,
		isBackend: false
	}
];
function mapNotificationDto(n) {
	return {
		id: n.id,
		title: n.title || "Thông báo hệ thống",
		message: n.message,
		time: new Date(n.createdAt).toLocaleString("vi-VN"),
		isRead: n.isRead,
		isBackend: true
	};
}
function NotificationBellMenu({ isLoggedIn }) {
	const [open, setOpen] = useState(false);
	const [filter, setFilter] = useState("all");
	const [items, setItems] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [busyAll, setBusyAll] = useState(false);
	const [err, setErr] = useState("");
	const ref = useRef(null);
	const live = isLoggedIn && !isSsrSmokeTest() && hasLiveBackendAuth();
	useEffect(() => {
		if (!open) return;
		const onDocClick = (e) => {
			if (!ref.current?.contains(e.target)) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	useEffect(() => {
		if (!isLoggedIn || isSsrSmokeTest()) {
			setItems([]);
			setUnreadCount(0);
			return;
		}
		if (!live) {
			setItems(FALLBACK_NOTES);
			setUnreadCount(FALLBACK_NOTES.filter((n) => !n.isRead).length);
			return;
		}
		let active = true;
		const syncNotifications = () => {
			setLoading(true);
			fetchMyNotifications({
				pageNumber: 1,
				pageSize: 20
			}).then((res) => {
				if (!active || !res.success || !res.data) return;
				setItems((res.data.items ?? []).map(mapNotificationDto));
				setUnreadCount(res.data.unreadCount ?? 0);
				setErr("");
			}).catch((error) => {
				if (active) setErr(error instanceof Error ? error.message : "Không tải được thông báo.");
			}).finally(() => {
				if (active) setLoading(false);
			});
		};
		syncNotifications();
		const onUpdated = (e) => {
			const detail = e.detail;
			if (typeof detail?.unreadCount === "number") {
				setUnreadCount(Math.max(0, detail.unreadCount));
				if (detail.unreadCount === 0) setItems((prev) => prev.map((it) => ({
					...it,
					isRead: true
				})));
				return;
			}
			if (typeof detail?.delta === "number") {
				setUnreadCount((c) => Math.max(0, c + detail.delta));
				return;
			}
			syncNotifications();
		};
		window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
		const connection = createNotificationHubConnection({
			onReceiveNotification: (incoming) => {
				if (!active) return;
				const mapped = mapNotificationDto(incoming);
				setItems((prev) => [mapped, ...prev.filter((x) => x.id !== mapped.id)].slice(0, 20));
				if (!mapped.isRead) setUnreadCount((c) => c + 1);
			},
			onUnreadCountUpdated: (payload) => {
				if (active && typeof payload?.unreadCount === "number") setUnreadCount(Math.max(0, payload.unreadCount));
			}
		});
		if (connection) connection.start().catch(() => {});
		return () => {
			active = false;
			window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
			if (connection) connection.stop().catch(() => {});
		};
	}, [isLoggedIn, live]);
	const handleMarkOne = async (note) => {
		if (note.isRead) return;
		setItems((prev) => prev.map((x) => x.id === note.id ? {
			...x,
			isRead: true
		} : x));
		setUnreadCount((c) => Math.max(0, c - 1));
		if (note.isBackend && live) try {
			await markNotificationRead(note.id);
		} catch {}
	};
	const handleMarkAll = async () => {
		if (busyAll || unreadCount === 0) return;
		if (!live) {
			setItems((prev) => prev.map((x) => ({
				...x,
				isRead: true
			})));
			setUnreadCount(0);
			return;
		}
		setBusyAll(true);
		try {
			await markAllNotificationsRead();
			setItems((prev) => prev.map((x) => ({
				...x,
				isRead: true
			})));
			setUnreadCount(0);
		} catch (error) {
			setErr(error instanceof Error ? error.message : "Không thể đánh dấu đã đọc tất cả.");
		} finally {
			setBusyAll(false);
		}
	};
	const visibleItems = filter === "unread" ? items.filter((n) => !n.isRead) : items;
	return /* @__PURE__ */ jsxs("div", {
		className: "sm:relative",
		ref,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			"aria-label": unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo",
			"aria-haspopup": "menu",
			"aria-expanded": open,
			onClick: () => setOpen((v) => !v),
			className: "group relative flex size-10 items-center justify-center rounded-full border border-line bg-white text-muted shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-sage-line hover:bg-surface-2 hover:text-ink active:scale-[0.96]",
			children: [/* @__PURE__ */ jsxs("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				className: "size-[18px] transition-transform duration-200 group-hover:scale-105",
				children: [/* @__PURE__ */ jsx("path", { d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" }), /* @__PURE__ */ jsx("path", { d: "M10.3 21a1.94 1.94 0 0 0 3.4 0" })]
			}), unreadCount > 0 && /* @__PURE__ */ jsx("span", {
				className: "absolute -top-1 -right-1 inline-flex min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-brand px-1 text-[10px] leading-[14px] font-bold text-white tabular-nums",
				children: unreadCount > 99 ? "99+" : unreadCount
			})]
		}), open && /* @__PURE__ */ jsxs("div", {
			role: "menu",
			"aria-label": "Danh sách thông báo",
			className: "absolute top-[calc(100%+0.5rem)] right-3 left-3 flex max-h-[calc(100dvh-5.75rem)] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_48px_-10px_rgba(15,31,21,0.18)] sm:top-full sm:right-0 sm:left-auto sm:mt-2.5 sm:w-[360px]",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between gap-2 border-b border-line-soft bg-surface-2/60 px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-base font-bold text-ink",
						children: "Thông báo"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-xs text-muted",
						children: unreadCount > 0 ? `${unreadCount} chưa đọc` : "Đã đọc tất cả"
					})] }), unreadCount > 0 && /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busyAll,
						onClick: () => void handleMarkAll(),
						className: "min-h-9 rounded-lg px-2.5 text-xs font-semibold text-brand-deep transition-colors hover:bg-surface-2 hover:underline disabled:opacity-50",
						children: busyAll ? "Đang xử lý..." : "Đọc tất cả"
					})]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "flex items-center gap-1.5 border-b border-line-soft px-4 py-2",
					children: [["all", `Tất cả (${items.length})`], ["unread", `Chưa đọc (${unreadCount})`]].map(([key, label]) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setFilter(key),
						className: `min-h-8 rounded-full px-3 text-xs font-semibold transition-colors ${filter === key ? "bg-brand/12 text-brand-deep" : "text-muted hover:bg-surface-2 hover:text-ink"}`,
						children: label
					}, key))
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex-1 divide-y divide-line-soft overflow-y-auto overscroll-contain",
					children: [err && /* @__PURE__ */ jsx("p", {
						role: "alert",
						className: "px-4 py-2.5 text-xs font-medium text-warn",
						children: err
					}), loading && items.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-sm text-muted",
						children: "Đang tải thông báo..."
					}) : visibleItems.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-sm text-muted",
						children: filter === "unread" ? "Không có thông báo chưa đọc." : "Chưa có thông báo nào."
					}) : visibleItems.map((note) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						role: "menuitem",
						onClick: () => void handleMarkOne(note),
						className: `flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${note.isRead ? "bg-white" : "bg-brand/[0.04]"}`,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-sm font-bold text-ink",
									children: note.title
								}), !note.isRead && /* @__PURE__ */ jsx("span", {
									className: "mt-1.5 size-2 shrink-0 rounded-full bg-brand",
									"aria-hidden": "true"
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-sm leading-5 text-body",
								children: note.message
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-xs text-muted tabular-nums",
								children: note.time
							})
						]
					}, note.id))]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "border-t border-line-soft bg-surface-2/40 px-4 py-2 text-right",
					children: /* @__PURE__ */ jsx(Link, {
						to: "/account/profile",
						onClick: () => setOpen(false),
						className: "inline-flex min-h-9 items-center text-xs font-semibold text-brand-deep hover:underline",
						children: "Hồ sơ cá nhân →"
					})
				})
			]
		})]
	});
}
//#endregion
//#region src/components/MobileNav.tsx
var TAB_ICON = {
	"/": Home,
	"/scanner": ScanLine,
	"/map": MapPin,
	"/rewards": Gift,
	"/blog": BookOpen
};
/** Bottom tab bar, only visible below the `lg` breakpoint. */
function MobileNav() {
	return /* @__PURE__ */ jsx("nav", {
		"aria-label": "Điều hướng chính (di động)",
		className: "fixed right-2 bottom-2.5 left-2 z-40 grid grid-cols-5 overflow-hidden rounded-[14px] border border-line/80 bg-white/94 shadow-[0_8px_28px_rgba(15,31,21,0.14)] backdrop-blur-xl min-[360px]:right-2.5 min-[360px]:left-2.5 lg:hidden",
		children: NAV_LINKS.map((link) => {
			const Icon = TAB_ICON[link.to];
			return /* @__PURE__ */ jsx(NavLink, {
				to: link.to,
				end: link.to === "/",
				title: link.label,
				"aria-label": link.label,
				className: ({ isActive }) => `flex min-h-[54px] flex-col items-center justify-start gap-1 border-0 border-r border-line/60 px-0.5 pt-2 pb-1.5 text-center text-[10px] leading-[1.15] font-semibold tracking-[-0.015em] transition-colors last:border-r-0 min-[412px]:text-[11px] sm:px-1 sm:text-xs sm:tracking-normal ${isActive ? "bg-surface-2 text-brand-deep" : "text-body"}`,
				children: ({ isActive }) => /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Icon, {
					"aria-hidden": "true",
					strokeWidth: isActive ? 2.15 : 1.75,
					className: "size-[17px] shrink-0 sm:size-[18px]"
				}), /* @__PURE__ */ jsx("span", { children: "mobileLabel" in link ? link.mobileLabel : link.label })] })
			}, link.to);
		})
	});
}
//#endregion
//#region src/components/Footer.tsx
var HEADING = "text-xs font-semibold tracking-[0.12em] text-brand uppercase";
var LINK = "text-sm leading-6 text-body transition-colors hover:text-brand-deep";
function Footer() {
	return /* @__PURE__ */ jsx("footer", {
		className: "border-t border-line-soft bg-white",
		children: /* @__PURE__ */ jsxs("div", {
			className: "page pt-12 pb-8",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1.3fr] lg:gap-8",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "sm:col-span-2 lg:col-span-1",
						children: [
							/* @__PURE__ */ jsx(Link, {
								to: "/",
								"aria-label": "EcoLink - Trang chủ",
								className: "inline-block",
								children: /* @__PURE__ */ jsx("img", {
									src: "/assets/brand/logo1.png",
									alt: "EcoLink",
									className: "w-[130px]"
								})
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-5 max-w-sm text-sm leading-[1.7] text-body",
								children: "Hạ tầng số hóa kết nối chuỗi giá trị thu gom, phân loại và tái chế tuần hoàn tại Việt Nam vì một tương lai không phát thải rác."
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mt-4 flex items-center gap-2 text-xs font-semibold text-brand",
								children: [/* @__PURE__ */ jsx("i", { className: "size-2.5 rounded-full bg-mint" }), "Dữ liệu thu gom minh bạch"]
							})
						]
					}),
					FOOTER_COLUMNS.map((col) => /* @__PURE__ */ jsx(FooterList, {
						title: col.title,
						items: col.links
					}, col.title)),
					/* @__PURE__ */ jsx(FooterList, {
						title: SUPPORT.title,
						note: SUPPORT.note,
						items: SUPPORT.links
					})
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs leading-5 text-muted sm:flex-row sm:items-center sm:justify-between",
				children: [/* @__PURE__ */ jsx("span", { children: "© 2026 EcoLink Circular Platform. Bảo lưu mọi quyền." }), /* @__PURE__ */ jsx("span", { children: "Hệ thống sẵn sàng tại các tỉnh thành" })]
			})]
		})
	});
}
function FooterList({ title, note, items }) {
	return /* @__PURE__ */ jsxs("div", { children: [
		/* @__PURE__ */ jsx("h3", {
			className: HEADING,
			children: title
		}),
		note && /* @__PURE__ */ jsx("p", {
			className: "mt-4 text-sm leading-6 text-body",
			children: note
		}),
		/* @__PURE__ */ jsx("ul", {
			className: `flex flex-col gap-2.5 ${note ? "mt-3" : "mt-4"}`,
			children: items.map((item) => /* @__PURE__ */ jsx("li", { children: typeof item === "string" ? /* @__PURE__ */ jsx("a", {
				href: "#",
				className: LINK,
				children: item
			}) : /* @__PURE__ */ jsx(Link, {
				to: item.to,
				className: LINK,
				children: item.label
			}) }, typeof item === "string" ? item : `${item.to}-${item.label}`))
		})
	] });
}
//#endregion
//#region src/components/VirtualTreeFab.tsx
var FAB_POS_KEY = "ecolink:tree-fab-pos-v1";
var DRAG_THRESHOLD_PX = 6;
function samePreview(a, b) {
	return a.stage === b.stage && a.label === b.label && a.water === b.water && a.isDead === b.isDead && a.harvestReady === b.harvestReady;
}
function resolveInitialPreview(isGuest, liveTreeUser, userKey) {
	if (liveTreeUser) {
		const cached = readLiveTreePreview(userKey);
		if (cached) return cached;
		return {
			stage: "seed",
			label: getStageName("seed"),
			water: null,
			isDead: false,
			harvestReady: false
		};
	}
	if (!isGuest) {
		const stored = readStoredTreePreview();
		if (stored) return {
			stage: stored.stage,
			label: stored.isDead ? "Héo khô" : getStageName(stored.stage),
			water: stored.water,
			isDead: stored.isDead,
			harvestReady: stored.harvestReady
		};
	}
	const stage = "seed";
	return {
		stage,
		label: getStageName(stage),
		water: 80,
		isDead: false,
		harvestReady: false
	};
}
function getWaterTheme(water, isDead) {
	if (water === null) return {
		stroke: "#cbd5e1",
		textClass: "text-muted border-line bg-white"
	};
	if (isDead || water <= 20) return {
		stroke: "#e11d48",
		textClass: "text-rose-700 border-rose-200 bg-white"
	};
	if (water < 30) return {
		stroke: "#d97706",
		textClass: "text-amber-700 border-amber-200 bg-white"
	};
	if (water >= 60 && water <= 90) return {
		stroke: "#0284c7",
		textClass: "text-sky-700 border-sky-200 bg-white"
	};
	return {
		stroke: "#2563eb",
		textClass: "text-blue-700 border-blue-200 bg-white"
	};
}
function readSavedRatio() {
	if (typeof window === "undefined") return {
		rx: 1,
		ry: 1
	};
	try {
		const raw = localStorage.getItem(FAB_POS_KEY);
		if (!raw) return {
			rx: 1,
			ry: 1
		};
		const parsed = JSON.parse(raw);
		if (typeof parsed.rx === "number" && typeof parsed.ry === "number") return {
			rx: Math.min(1, Math.max(0, parsed.rx)),
			ry: Math.min(1, Math.max(0, parsed.ry))
		};
	} catch {}
	return {
		rx: 1,
		ry: 1
	};
}
function getViewportSize() {
	return {
		w: document.documentElement.clientWidth || window.innerWidth,
		h: document.documentElement.clientHeight || window.innerHeight
	};
}
function getSafeBounds(w, h) {
	const desktop = w >= 1024;
	const size = w >= 640 ? 60 : 58;
	const marginX = desktop ? 24 : 14;
	const minX = marginX;
	const maxX = Math.max(minX, w - size - marginX);
	const minY = desktop ? 88 : 80;
	return {
		minX,
		maxX,
		minY,
		maxY: Math.max(minY, h - size - (desktop ? 24 : 90)),
		size
	};
}
function clampRatioToPixels(ratio, w, h) {
	const { minX, maxX, minY, maxY } = getSafeBounds(w, h);
	return {
		x: Math.round(minX + ratio.rx * (maxX - minX)),
		y: Math.round(minY + ratio.ry * (maxY - minY))
	};
}
/** Nút nổi hình tròn (`58px`/`60px`): viền ngoài mảnh hiển thị mực nước rút đối xứng 2 bên,
*  lòng trong là ảnh cây thật của Cây Ảo EcoLink kèm nhãn `%`, kéo thả tự do trên 4 trang chính. */
function VirtualTreeFab() {
	const { pathname } = useLocation();
	const session = useSession();
	const isGuest = !session && !isSsrSmokeTest();
	const liveTreeUser = hasLiveBackendAuth() && session?.role === "user";
	const userKey = session?.id || session?.name || "";
	const [preview, setPreview] = useState(() => resolveInitialPreview(isGuest, liveTreeUser, userKey));
	const [ratioPos, setRatioPos] = useState(() => readSavedRatio());
	const [coords, setCoords] = useState(() => {
		if (isSsrSmokeTest() || typeof window === "undefined") return null;
		const { w, h } = getViewportSize();
		return clampRatioToPixels(readSavedRatio(), w, h);
	});
	const [dragging, setDragging] = useState(false);
	const dragRef = useRef(null);
	const suppressClickRef = useRef(false);
	useEffect(() => {
		if (!liveTreeUser) {
			if (isGuest) clearLiveTreePreview();
			const next = resolveInitialPreview(isGuest, liveTreeUser, userKey);
			setPreview((prev) => samePreview(prev, next) ? prev : next);
		} else {
			const cached = readLiveTreePreview(userKey);
			if (cached) setPreview((prev) => samePreview(prev, cached) ? prev : cached);
			let active = true;
			fetchMyVirtualTree().then((res) => {
				if (!active || !res.data) return;
				const next = saveLiveTreePreview(userKey, res.data);
				setPreview((prev) => samePreview(prev, next) ? prev : next);
			}).catch(() => {
				if (!active || readLiveTreePreview(userKey)) return;
				setPreview((prev) => prev.water === null ? {
					...prev,
					water: 80
				} : prev);
			});
			return () => {
				active = false;
			};
		}
		if (isGuest || typeof window === "undefined") return;
		const onStorage = (e) => {
			if (e.key === "ecolink:virtual-tree-v1") {
				const next = resolveInitialPreview(isGuest, liveTreeUser, userKey);
				setPreview((prev) => samePreview(prev, next) ? prev : next);
			}
		};
		window.addEventListener("storage", onStorage);
		return () => window.removeEventListener("storage", onStorage);
	}, [
		pathname,
		isGuest,
		liveTreeUser,
		userKey
	]);
	useEffect(() => {
		if (typeof window === "undefined") return;
		const syncCoords = () => {
			const { w, h } = getViewportSize();
			const next = clampRatioToPixels(ratioPos, w, h);
			setCoords((prev) => prev && prev.x === next.x && prev.y === next.y ? prev : next);
		};
		syncCoords();
		window.addEventListener("resize", syncCoords);
		return () => window.removeEventListener("resize", syncCoords);
	}, [ratioPos]);
	const handlePointerDown = (e) => {
		if (e.button !== 0 || typeof window === "undefined") return;
		suppressClickRef.current = false;
		const { w, h } = getViewportSize();
		const current = coords ?? clampRatioToPixels(ratioPos, w, h);
		dragRef.current = {
			pointerId: e.pointerId,
			startClientX: e.clientX,
			startClientY: e.clientY,
			startX: current.x,
			startY: current.y,
			moved: false
		};
		const onMove = (ev) => {
			const d = dragRef.current;
			if (!d || d.pointerId !== ev.pointerId) return;
			const dx = ev.clientX - d.startClientX;
			const dy = ev.clientY - d.startClientY;
			if (!d.moved) {
				if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
				d.moved = true;
				suppressClickRef.current = true;
				setDragging(true);
			}
			const vw = getViewportSize();
			const { minX, maxX, minY, maxY } = getSafeBounds(vw.w, vw.h);
			setCoords({
				x: Math.min(maxX, Math.max(minX, Math.round(d.startX + dx))),
				y: Math.min(maxY, Math.max(minY, Math.round(d.startY + dy)))
			});
		};
		const onEnd = (ev) => {
			const d = dragRef.current;
			if (!d || d.pointerId !== ev.pointerId) return;
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onEnd);
			window.removeEventListener("pointercancel", onEnd);
			dragRef.current = null;
			if (!d.moved) return;
			setDragging(false);
			const vw = getViewportSize();
			const { minX, maxX, minY, maxY } = getSafeBounds(vw.w, vw.h);
			const curX = Math.min(maxX, Math.max(minX, Math.round(d.startX + (ev.clientX - d.startClientX))));
			const curY = Math.min(maxY, Math.max(minY, Math.round(d.startY + (ev.clientY - d.startClientY))));
			const nextRatio = {
				rx: maxX > minX ? (curX - minX) / (maxX - minX) : 1,
				ry: maxY > minY ? (curY - minY) / (maxY - minY) : 1
			};
			setRatioPos(nextRatio);
			setCoords({
				x: curX,
				y: curY
			});
			try {
				localStorage.setItem(FAB_POS_KEY, JSON.stringify(nextRatio));
			} catch {}
			window.setTimeout(() => {
				suppressClickRef.current = false;
			}, 60);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onEnd);
		window.addEventListener("pointercancel", onEnd);
	};
	const handleClick = (e) => {
		if (suppressClickRef.current) {
			e.preventDefault();
			e.stopPropagation();
			suppressClickRef.current = false;
		}
	};
	const waterRatio = preview.water !== null ? preview.water / 100 : 0;
	const radius = 22.75;
	const circumference = 2 * Math.PI * radius;
	const dashOffset = circumference * (1 - waterRatio);
	const arcRotation = 90 - 180 * waterRatio;
	const waterTheme = getWaterTheme(preview.water, preview.isDead);
	const frameSrc = getFrameSrc(getDefaultFrameForStage(preview.stage));
	const waterLabel = preview.water !== null ? `${preview.water}%` : "--";
	const tooltipOnRight = ratioPos.rx < .45;
	const ariaLabel = `Mở Cây Ảo EcoLink (${preview.label}${preview.water !== null ? `, mực nước ${preview.water}%` : ""}) — có thể kéo để di chuyển`;
	return /* @__PURE__ */ jsxs(Link, {
		to: "/ecofacts",
		"aria-label": ariaLabel,
		title: `Cây Ảo EcoLink · ${preview.label}${preview.water !== null ? ` · Ẩm ${preview.water}%` : ""} (Kéo để di chuyển)`,
		onPointerDown: handlePointerDown,
		onClick: handleClick,
		draggable: false,
		style: coords ? {
			left: `${coords.x}px`,
			top: `${coords.y}px`
		} : void 0,
		className: `group fixed z-30 flex size-[58px] touch-none select-none items-center justify-center rounded-full bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 sm:size-[60px] lg:z-40 ${coords ? "" : "right-3.5 bottom-20 lg:right-6 lg:bottom-6"} ${dragging ? "cursor-grabbing shadow-[0_16px_32px_-6px_rgba(15,31,21,0.24)]" : "cursor-grab shadow-[0_8px_22px_-4px_rgba(15,31,21,0.18),0_2px_6px_rgba(15,31,21,0.08)] transition-shadow duration-200 hover:shadow-[0_12px_26px_-4px_rgba(15,31,21,0.24)]"}`,
		children: [
			/* @__PURE__ */ jsxs("svg", {
				viewBox: "0 0 48 48",
				"aria-hidden": "true",
				className: "pointer-events-none absolute inset-0 size-full",
				children: [/* @__PURE__ */ jsx("circle", {
					cx: "24",
					cy: "24",
					r: radius,
					fill: "none",
					stroke: "#e2e8f0",
					strokeWidth: "2.5"
				}), preview.water !== null && preview.water > 0 && /* @__PURE__ */ jsx("circle", {
					cx: "24",
					cy: "24",
					r: radius,
					fill: "none",
					stroke: waterTheme.stroke,
					strokeWidth: "2.5",
					strokeLinecap: "round",
					strokeDasharray: circumference,
					strokeDashoffset: dashOffset,
					transform: `rotate(${arcRotation} 24 24)`
				})]
			}),
			/* @__PURE__ */ jsx("span", {
				className: "pointer-events-none relative block size-[50px] overflow-hidden rounded-full bg-sky-100 isolate sm:size-[52px]",
				children: /* @__PURE__ */ jsx("img", {
					src: frameSrc,
					alt: "",
					draggable: false,
					className: `${getTreeAvatarImgClass(preview.stage)} select-none ${preview.isDead ? "grayscale contrast-125 opacity-75" : ""}`
				})
			}),
			/* @__PURE__ */ jsx("span", {
				className: `pointer-events-none absolute -bottom-1.5 left-1/2 min-w-[34px] -translate-x-1/2 rounded-full border px-1.5 py-[1.5px] text-center text-[10.5px] leading-none font-bold tabular-nums shadow-2xs ${waterTheme.textClass}`,
				children: waterLabel
			}),
			/* @__PURE__ */ jsx("span", {
				className: `pointer-events-none absolute top-1/2 hidden -translate-y-1/2 items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold whitespace-nowrap text-ink shadow-[0_8px_20px_-4px_rgba(15,31,21,0.14)] transition-opacity duration-150 lg:flex ${tooltipOnRight ? "left-full ml-3" : "right-full mr-3"} ${dragging ? "opacity-0" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`,
				children: /* @__PURE__ */ jsxs("span", { children: ["Cây Ảo · ", preview.label] })
			})
		]
	});
}
//#endregion
//#region src/components/Layout.tsx
var TREE_FAB_ROUTES = /* @__PURE__ */ new Set([
	"/",
	"/scanner",
	"/map",
	"/rewards"
]);
/** Khung dùng chung cho mọi trang công khai và portal (hộp thoại đăng nhập/đăng ký Trang Nhỏ được render toàn cục). */
function Layout() {
	const { pathname } = useLocation();
	const showTreeFab = TREE_FAB_ROUTES.has(pathname);
	const isChatPage = pathname === "/chat";
	const isRecyclerPortal = pathname === "/recycler" || pathname.startsWith("/recycler/");
	useEffect(() => {
		window.scrollTo({ top: 0 });
		ensureActiveAuthSession();
	}, [pathname]);
	return /* @__PURE__ */ jsxs("div", {
		className: `min-h-dvh bg-page ${isChatPage ? "pb-[68px] lg:pb-0" : "pb-20 lg:pb-0"}`,
		children: [
			/* @__PURE__ */ jsx(Navbar, {}),
			/* @__PURE__ */ jsx("main", {
				className: "pt-[70px] md:pt-[76px]",
				children: /* @__PURE__ */ jsx(Suspense, {
					fallback: null,
					children: /* @__PURE__ */ jsx(Outlet, {})
				})
			}),
			!isChatPage && !isRecyclerPortal && /* @__PURE__ */ jsx(Footer, {}),
			showTreeFab && /* @__PURE__ */ jsx(VirtualTreeFab, {}),
			/* @__PURE__ */ jsx(MobileNav, {})
		]
	});
}
//#endregion
//#region src/data/portal.ts
var PORTAL_NAV = {
	user: [],
	recycler: [{
		title: "Vận hành",
		items: [
			{
				to: "/recycler",
				label: "Tổng quan"
			},
			{
				to: "/recycler/requests",
				label: "Yêu cầu bàn giao"
			},
			{
				to: "/chat",
				label: "Chat thương lượng"
			},
			{
				to: "/recycler/catalog",
				label: "Danh mục và bảng giá"
			},
			{
				to: "/recycler/receipt",
				label: "Biên nhận thu gom"
			},
			{
				to: "/recycler/facility",
				label: "Hồ sơ kho bãi"
			},
			{
				to: "/recycler/reviews",
				label: "Đánh giá từ người dùng"
			},
			{
				to: "/recycler/packages",
				label: "Gói dịch vụ Pro"
			}
		]
	}],
	staff: [
		{
			title: "Dữ liệu AI",
			items: [
				{
					to: "/staff",
					label: "Tổng quan"
				},
				{
					to: "/staff/ai-review",
					label: "Ảnh AI nhận diện sai"
				},
				{
					to: "/staff/dataset",
					label: "Tập dữ liệu kiểm chứng"
				}
			]
		},
		{
			title: "Vận hành",
			items: [
				{
					to: "/staff/applications",
					label: "Hồ sơ đối tác thu mua"
				},
				{
					to: "/staff/complaints",
					label: "Khiếu nại giao dịch"
				},
				{
					to: "/staff/accounts",
					label: "Tài khoản User/Recycler"
				},
				{
					to: "/staff/blog",
					label: "Soạn bài Blog"
				},
				{
					to: "/staff/ecofacts",
					label: "Nội dung Eco Fact"
				},
				{
					to: "/staff/gifts",
					label: "Kho quà tặng"
				}
			]
		},
		{
			title: "Khác",
			items: [{
				to: "/staff/account",
				label: "Hồ sơ và thông báo"
			}, {
				to: "/staff/account/password",
				label: "Đổi mật khẩu"
			}]
		}
	],
	admin: [{
		title: "Quản trị",
		items: [
			{
				to: "/admin",
				label: "Dashboard thống kê"
			},
			{
				to: "/admin/reports",
				label: "Xuất báo cáo"
			},
			{
				to: "/admin/staff",
				label: "Tài khoản Staff"
			},
			{
				to: "/admin/permissions",
				label: "Phân quyền Staff"
			},
			{
				to: "/admin/blog",
				label: "Duyệt bài Blog"
			}
		]
	}, {
		title: "Cấu hình nghiệp vụ",
		items: [
			{
				to: "/admin/categories",
				label: "Danh mục rác"
			},
			{
				to: "/admin/policy",
				label: "Chính sách phân loại"
			},
			{
				to: "/admin/gamification",
				label: "Cấu hình điểm"
			},
			{
				to: "/admin/leaderboard",
				label: "Chu kỳ xếp hạng"
			},
			{
				to: "/admin/fees",
				label: "Phí giao dịch"
			},
			{
				to: "/admin/reconciliation",
				label: "Đối soát dòng tiền"
			}
		]
	}]
};
//#endregion
//#region src/components/admin/Shell.tsx
var STAFF_ROUTE_PERMISSIONS = {
	"/staff/ai-review": ["REVIEW_AI", "ai.review"],
	"/staff/dataset": ["CURATE_DATASET", "ai.dataset"],
	"/staff/applications": ["VERIFY_RECYCLER", "partner.verify"],
	"/staff/complaints": ["HANDLE_COMPLAINT", "complaint.handle"],
	"/staff/accounts": ["MANAGE_ACCOUNTS", "account.manage"],
	"/staff/blog": ["MANAGE_BLOG", "blog.write"],
	"/staff/ecofacts": ["MANAGE_INVENTORY", "gift.manage"],
	"/staff/gifts": ["MANAGE_INVENTORY", "gift.manage"]
};
function hasStaffRouteAccess(path, permissions) {
	const required = STAFF_ROUTE_PERMISSIONS[path.replace(/\/+$/, "") || "/"];
	if (!required) return true;
	if (!permissions || permissions.length === 0) return false;
	const granted = new Set(permissions.map((p) => p.trim().toUpperCase()));
	return required.some((req) => granted.has(req.toUpperCase()));
}
/** Menu tài khoản nội bộ.
*
*  KHÔNG dùng `/account/profile` và `/account/password` của người dân: đó là
*  trang của tài khoản công khai — nội dung khác hẳn (điểm cây ảo, lịch thu
*  gom, yêu cầu bàn giao) và bấm vào sẽ rời khỏi console ra trang có navbar.
*  Trang riêng cho staff và admin nằm cùng khung `AdminShell`, ở `/{role}/account`. */
var ACCOUNT_ITEMS = {
	recycler: [
		["/", "Home"],
		["/recycler/facility", "Hồ sơ kho bãi"],
		["/recycler/packages", "Gói dịch vụ Pro"],
		["/account/profile", "Hồ sơ cá nhân"],
		["/account/password", "Đổi mật khẩu"]
	],
	staff: [["/staff/account", "Hồ sơ và thông báo"], ["/staff/account/password", "Đổi mật khẩu"]],
	admin: [["/admin/account", "Hồ sơ và thông báo"], ["/admin/account/password", "Đổi mật khẩu"]]
};
/** Khung làm việc dùng chung cho RECYCLER, STAFF và ADMIN.
*
*  Tách khỏi `Layout` công khai: không mang navbar công khai, footer hay tab-bar dưới
*  trên mobile; thay bằng một thanh đầu trang 56px gọn nhẹ, sidebar sticky ở desktop
*  và slide-over drawer đồng bộ trên mobile. */
function AdminShell({ role }) {
	const session = useSession();
	const navigate = useNavigate();
	const location = useLocation();
	const [open, setOpen] = useState(false);
	const [confirmLogout, setConfirmLogout] = useState(false);
	useEffect(() => {
		if (role === "staff" && session?.fromBackend && !Array.isArray(session.permissions)) fetchCurrentUserProfile();
	}, [
		role,
		session?.fromBackend,
		session?.permissions
	]);
	useEffect(() => {
		setOpen(false);
	}, [location.pathname]);
	useEffect(() => {
		if (!open) return;
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);
	const enforceStaffRbac = role === "staff" && Boolean(session?.fromBackend) && Array.isArray(session?.permissions);
	const navSections = useMemo(() => {
		const sections = PORTAL_NAV[role];
		if (!enforceStaffRbac) return sections;
		return sections.map((sec) => ({
			...sec,
			items: sec.items.filter((item) => hasStaffRouteAccess(item.to, session?.permissions))
		})).filter((sec) => sec.items.length > 0);
	}, [
		enforceStaffRbac,
		role,
		session?.permissions
	]);
	const staffRouteAllowed = !enforceStaffRbac || hasStaffRouteAccess(location.pathname, session?.permissions);
	const logout = () => {
		setConfirmLogout(true);
	};
	const handleConfirmLogout = () => {
		signOut();
		setConfirmLogout(false);
		navigate("/");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-page",
		children: [
			/* @__PURE__ */ jsx("header", {
				className: "sticky top-0 z-40 h-14 border-b border-line-soft bg-white/90 backdrop-blur-xl",
				children: /* @__PURE__ */ jsxs("div", {
					className: "flex h-full items-center gap-2.5 px-3 sm:gap-3 sm:px-4 lg:px-6",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setOpen((v) => !v),
							"aria-expanded": open,
							"aria-controls": "admin-nav",
							className: "grid size-10 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden",
							children: [/* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 24 24",
								className: "size-5",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.8",
								strokeLinecap: "round",
								"aria-hidden": "true",
								children: /* @__PURE__ */ jsx("path", { d: "M4 7h16M4 12h16M4 17h16" })
							}), /* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: "Mở menu"
							})]
						}),
						role === "recycler" ? /* @__PURE__ */ jsx(Link, {
							to: "/",
							"aria-label": "EcoLink - Trang chủ",
							className: "shrink-0",
							children: /* @__PURE__ */ jsx("img", {
								src: "/assets/brand/logo1.png",
								alt: "EcoLink",
								className: "h-6 w-auto sm:h-7"
							})
						}) : /* @__PURE__ */ jsx("img", {
							src: "/assets/brand/logo1.png",
							alt: "EcoLink",
							className: "h-6 w-auto shrink-0 sm:h-7"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "shrink-0 rounded-md bg-brand/10 px-2 py-1 text-[10px] font-bold tracking-[0.08em] text-brand uppercase sm:text-[11px]",
							children: ROLE_LABEL[role]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "ml-auto flex shrink-0 items-center gap-2 sm:gap-2.5",
							children: [
								role === "recycler" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs(Link, {
									to: "/",
									title: "Home",
									"aria-label": "Home",
									className: "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-2.5 text-xs font-semibold text-body transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink sm:px-3",
									children: [/* @__PURE__ */ jsx(Home, {
										className: "size-4 shrink-0 text-brand",
										"aria-hidden": "true"
									}), /* @__PURE__ */ jsx("span", {
										className: "hidden sm:inline",
										children: "Home"
									})]
								}), /* @__PURE__ */ jsx(Link, {
									to: "/chat",
									title: "Chat thương lượng",
									"aria-label": "Chat thương lượng",
									className: "grid size-10 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink",
									children: /* @__PURE__ */ jsx(MessageSquare, {
										className: "size-4",
										"aria-hidden": "true"
									})
								})] }),
								/* @__PURE__ */ jsx(NotificationBellPopover, { role }),
								/* @__PURE__ */ jsx(AccountMenu, {
									name: session?.name ?? "",
									avatarUrl: session?.avatarUrl,
									label: ROLE_LABEL[role],
									items: ACCOUNT_ITEMS[role]
								})
							]
						})
					]
				})
			}),
			open && /* @__PURE__ */ jsx("div", {
				onClick: () => setOpen(false),
				"aria-hidden": "true",
				className: "fixed inset-0 z-40 bg-ink/40 backdrop-blur-[1px] lg:hidden"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex min-w-0",
				children: [/* @__PURE__ */ jsxs("aside", {
					className: `${open ? "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] shadow-2xl" : "hidden"} flex-col border-r border-line-soft bg-white lg:sticky lg:top-14 lg:z-auto lg:flex lg:h-[calc(100dvh-3.5rem)] lg:w-58 lg:shrink-0 lg:shadow-none`,
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex h-14 shrink-0 items-center justify-between border-b border-line-soft px-4 lg:hidden",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-2",
								children: [/* @__PURE__ */ jsx("img", {
									src: "/assets/brand/logo1.png",
									alt: "EcoLink",
									className: "h-6 w-auto"
								}), /* @__PURE__ */ jsx("span", {
									className: "rounded-md bg-brand/10 px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] text-brand uppercase",
									children: ROLE_LABEL[role]
								})]
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setOpen(false),
								"aria-label": "Đóng menu",
								className: "grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink",
								children: /* @__PURE__ */ jsx(X, { className: "size-4" })
							})]
						}),
						/* @__PURE__ */ jsx("nav", {
							id: "admin-nav",
							"aria-label": "Điều hướng khu vực quản trị",
							className: "min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:py-6",
							children: navSections.map((sec) => /* @__PURE__ */ jsxs("div", {
								className: "pb-5",
								children: [/* @__PURE__ */ jsx("h2", {
									className: "px-3 text-[11px] font-bold tracking-[0.12em] text-brand uppercase",
									children: sec.title
								}), /* @__PURE__ */ jsx("ul", {
									className: "mt-1.5 flex flex-col gap-0.5",
									children: sec.items.map((item) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(NavLink, {
										to: item.to,
										end: item.to.split("/").length <= 2,
										onClick: () => setOpen(false),
										className: ({ isActive }) => `flex min-h-10 items-center rounded-md px-3 py-2 text-sm leading-5 font-medium transition-colors ${isActive ? "bg-brand text-white" : "text-body hover:bg-surface-2 hover:text-ink"}`,
										children: item.label
									}) }, item.to))
								})]
							}, sec.title))
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => {
								setOpen(false);
								logout();
							},
							className: "mx-4 mt-auto mb-4 min-h-11 w-[calc(100%-2rem)] shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-800",
							children: "Đăng xuất"
						})
					]
				}), /* @__PURE__ */ jsx("main", {
					className: `min-w-0 flex-1 ${location.pathname === "/chat" ? "p-0" : "px-4 py-5 sm:py-6 lg:px-8 lg:py-8"}`,
					children: !staffRouteAllowed ? /* @__PURE__ */ jsxs("div", {
						role: "alert",
						className: "mx-auto max-w-xl rounded-2xl border border-warn/30 bg-warn/5 p-6 text-sm text-ink",
						children: [
							/* @__PURE__ */ jsx("p", {
								className: "text-base font-bold text-warn",
								children: "Bạn chưa được cấp quyền cho chức năng này (BR-ADM-02)"
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mt-2 leading-6 text-body",
								children: [
									"Tài khoản Nhân viên hiện chưa có mã quyền vận hành phù hợp cho trang",
									" ",
									/* @__PURE__ */ jsx("code", {
										className: "rounded bg-white px-1.5 py-0.5 text-xs",
										children: location.pathname
									}),
									". Vui lòng liên hệ Quản trị viên để được bật quyền tại mục Phân quyền Staff."
								]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-4",
								children: /* @__PURE__ */ jsx(Link, {
									to: "/staff",
									className: "btn-primary inline-flex min-h-10 items-center px-4 text-sm font-semibold",
									children: "Quay về tổng quan Nhân viên"
								})
							})
						]
					}) : /* @__PURE__ */ jsx(Suspense, {
						fallback: null,
						children: /* @__PURE__ */ jsx(Outlet, {})
					})
				})]
			}),
			/* @__PURE__ */ jsx(ConfirmLogoutDialog, {
				open: confirmLogout,
				onClose: () => setConfirmLogout(false),
				onConfirm: handleConfirmLogout,
				userName: session?.name
			})
		]
	});
}
/** Avatar + menu tài khoản ở thanh trên.
*
*  Menu tài khoản KHÔNG nằm trong sidebar: sidebar là danh sách màn hình của
*  khu vực làm việc, trộn 2 mục tài khoản dùng chung vào đó thì không phân biệt
*  được đâu là việc công việc, đâu là việc của chính mình. Ở đây nó nằm sau
*  avatar, đúng chỗ của nó ở mọi app khác. */
function AccountMenu({ name, avatarUrl, label, items }) {
	const [open, setOpen] = useState(false);
	const ref = useRef(null);
	useEffect(() => {
		if (!open) return;
		const onDocClick = (e) => {
			if (!ref.current?.contains(e.target)) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	return /* @__PURE__ */ jsxs("div", {
		className: "relative",
		ref,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			"aria-label": `Tài khoản: ${name}`,
			"aria-haspopup": "menu",
			"aria-expanded": open,
			onClick: () => setOpen((v) => !v),
			className: "flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-1 transition-colors hover:border-sage-line hover:bg-surface-2",
			children: [/* @__PURE__ */ jsx(UserAvatar, {
				name,
				avatarUrl,
				size: "sm"
			}), /* @__PURE__ */ jsx("svg", {
				viewBox: "0 0 16 16",
				fill: "none",
				"aria-hidden": "true",
				className: "size-3.5 text-muted",
				children: /* @__PURE__ */ jsx("path", {
					d: "m4 6 4 4 4-4",
					stroke: "currentColor",
					strokeWidth: "1.8",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			})]
		}), open && /* @__PURE__ */ jsxs("div", {
			role: "menu",
			className: "absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.16)]",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-3 border-b border-line-soft bg-surface-2/60 p-4",
				children: [/* @__PURE__ */ jsx(UserAvatar, {
					name,
					avatarUrl,
					size: "md"
				}), /* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsx("p", {
						className: "truncate text-sm font-bold text-ink",
						children: name
					}), /* @__PURE__ */ jsx("p", {
						className: "text-sm text-muted",
						children: label
					})]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "p-2",
				children: [items.map(([to, item]) => /* @__PURE__ */ jsxs(Link, {
					to,
					onClick: () => setOpen(false),
					className: "flex min-h-10 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-body transition-colors hover:bg-surface-2 hover:text-ink",
					children: [/* @__PURE__ */ jsxs("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "1.8",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						className: "size-4 text-muted",
						children: [/* @__PURE__ */ jsx("circle", {
							cx: "12",
							cy: "8",
							r: "3.5"
						}), /* @__PURE__ */ jsx("path", { d: "M12 14c-3.9 0-7 2.4-7 5.4V21h14v-1.6c0-3-3.1-5.4-7-5.4Z" })]
					}), item]
				}, to)), /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => {
						setOpen(false);
						signOut();
						openAuthPopup("login");
					},
					className: "mt-1 flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 hover:text-red-800",
					children: [/* @__PURE__ */ jsx("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						"aria-hidden": "true",
						className: "size-4",
						children: /* @__PURE__ */ jsx("path", {
							d: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9",
							stroke: "currentColor",
							strokeWidth: "1.8",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					}), "Đổi tài khoản"]
				})]
			})]
		})]
	});
}
function NotificationBellPopover({ role }) {
	const session = useSession();
	const live = Boolean(session) && !isSsrSmokeTest() && hasLiveBackendAuth();
	const [open, setOpen] = useState(false);
	const [items, setItems] = useState([]);
	const [unreadCount, setUnreadCount] = useState(0);
	const [loading, setLoading] = useState(false);
	const [busyAll, setBusyAll] = useState(false);
	const [err, setErr] = useState("");
	const ref = useRef(null);
	useEffect(() => {
		if (!open) return;
		const onDocClick = (e) => {
			if (!ref.current?.contains(e.target)) setOpen(false);
		};
		const onKey = (e) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);
	useEffect(() => {
		if (!live) {
			setItems([]);
			setUnreadCount(0);
			return;
		}
		let active = true;
		const syncNotifications = () => {
			setLoading(true);
			fetchMyNotifications({
				pageNumber: 1,
				pageSize: 10
			}).then((res) => {
				if (!active || !res.success || !res.data) return;
				setItems(res.data.items ?? []);
				setUnreadCount(res.data.unreadCount ?? 0);
				setErr("");
			}).catch((error) => {
				if (active) setErr(error instanceof Error ? error.message : "Không tải được thông báo.");
			}).finally(() => {
				if (active) setLoading(false);
			});
		};
		syncNotifications();
		const onUpdated = (e) => {
			const detail = e.detail;
			if (typeof detail?.unreadCount === "number") {
				setUnreadCount(Math.max(0, detail.unreadCount));
				if (detail.unreadCount === 0) setItems((prev) => prev.map((it) => ({
					...it,
					isRead: true
				})));
				return;
			}
			if (typeof detail?.delta === "number") {
				setUnreadCount((c) => Math.max(0, c + detail.delta));
				return;
			}
			syncNotifications();
		};
		window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
		const connection = createNotificationHubConnection({
			onReceiveNotification: (incoming) => {
				if (!active) return;
				setItems((prev) => [incoming, ...prev.filter((x) => x.id !== incoming.id)].slice(0, 10));
				if (!incoming.isRead) setUnreadCount((c) => c + 1);
			},
			onUnreadCountUpdated: (payload) => {
				if (active && typeof payload?.unreadCount === "number") setUnreadCount(Math.max(0, payload.unreadCount));
			}
		});
		if (connection) connection.start().catch(() => {});
		return () => {
			active = false;
			window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
			if (connection) connection.stop().catch(() => {});
		};
	}, [live]);
	const handleMarkOne = async (n) => {
		if (n.isRead || !live) return;
		try {
			await markNotificationRead(n.id);
			setItems((prev) => prev.map((x) => x.id === n.id ? {
				...x,
				isRead: true
			} : x));
		} catch {}
	};
	const handleMarkAll = async () => {
		if (!live || busyAll || unreadCount === 0) return;
		setBusyAll(true);
		try {
			await markAllNotificationsRead();
			setItems((prev) => prev.map((x) => ({
				...x,
				isRead: true
			})));
			setUnreadCount(0);
		} catch (error) {
			setErr(error instanceof Error ? error.message : "Không thể đánh dấu đã đọc tất cả.");
		} finally {
			setBusyAll(false);
		}
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "relative",
		ref,
		children: [/* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: () => setOpen((v) => !v),
			"aria-label": unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo",
			"aria-expanded": open,
			className: "relative grid size-10 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink",
			children: [/* @__PURE__ */ jsxs("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				strokeWidth: "1.8",
				strokeLinecap: "round",
				strokeLinejoin: "round",
				"aria-hidden": "true",
				className: "size-4",
				children: [/* @__PURE__ */ jsx("path", { d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" }), /* @__PURE__ */ jsx("path", { d: "M10.3 21a1.94 1.94 0 0 0 3.4 0" })]
			}), unreadCount > 0 && /* @__PURE__ */ jsx("span", {
				className: "absolute -top-1 -right-1 inline-flex min-w-[17px] items-center justify-center rounded-full border-2 border-white bg-brand px-1 text-[10px] leading-[13px] font-bold text-white tabular-nums",
				children: unreadCount > 99 ? "99+" : unreadCount
			})]
		}), open && /* @__PURE__ */ jsxs("div", {
			role: "dialog",
			"aria-label": "Hộp thông báo nội bộ",
			className: "fixed inset-x-3 top-16 z-50 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.18)] sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between border-b border-line-soft bg-surface-2/70 px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm font-bold text-ink",
						children: "Thông báo hệ thống"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-xs text-muted",
						children: unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Đã đọc tất cả"
					})] }), live && unreadCount > 0 && /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busyAll,
						onClick: () => void handleMarkAll(),
						className: "min-h-10 px-2 text-sm font-semibold text-brand-deep hover:underline disabled:opacity-50",
						children: busyAll ? "Đang xử lý..." : "Đọc tất cả"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "max-h-80 overflow-y-auto divide-y divide-line-soft",
					children: [err && /* @__PURE__ */ jsx("p", {
						role: "alert",
						className: "px-4 py-2.5 text-sm font-medium text-warn",
						children: err
					}), !live ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-sm leading-6 text-muted",
						children: "Kết nối tài khoản Backend để nhận thông báo thời gian thực."
					}) : loading && items.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-sm leading-6 text-muted",
						children: "Đang tải thông báo..."
					}) : items.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-sm leading-6 text-muted",
						children: "Chưa có thông báo nào."
					}) : items.map((n) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => void handleMarkOne(n),
						className: `flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${n.isRead ? "bg-white" : "bg-brand/5"}`,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-sm font-bold text-ink",
									children: n.title
								}), !n.isRead && /* @__PURE__ */ jsx("span", {
									className: "mt-1 size-2 shrink-0 rounded-full bg-brand",
									"aria-hidden": "true"
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-sm leading-6 text-body",
								children: n.message
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-xs text-muted tabular-nums",
								children: new Date(n.createdAt).toLocaleString("vi-VN")
							})
						]
					}, n.id))]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "border-t border-line-soft bg-surface-2/40 px-4 py-2.5 text-right",
					children: /* @__PURE__ */ jsx(Link, {
						to: role === "recycler" ? "/account/profile" : `/${role}/account`,
						onClick: () => setOpen(false),
						className: "inline-flex min-h-10 items-center text-sm font-semibold text-brand-deep hover:underline",
						children: "Mở trang Hồ sơ & Thông báo →"
					})
				})
			]
		})]
	});
}
//#endregion
//#region src/components/RequireRole.tsx
/** Chốt chặn route theo vai trò. Chưa đăng nhập -> về trang chủ / và mở hộp thoại đăng nhập nhỏ,
*  đã đăng nhập sai vai trò -> về trang chủ của vai trò đó, đồng thời đối chiếu Cookie với Backend. */
function RequireRole({ roles, children }) {
	const session = useSession() ?? getSession();
	const sessionIdentity = session ? `${session.id ?? session.username ?? session.name}:${session.role}` : null;
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!sessionIdentity) {
			openAuthPopup("login", false);
			return;
		}
		ensureActiveAuthSession();
	}, [sessionIdentity]);
	if (!session) return /* @__PURE__ */ jsx(Navigate, {
		to: "/",
		replace: true
	});
	if (!roles.includes(session.role)) return /* @__PURE__ */ jsx(Navigate, {
		to: ROLE_HOME[session.role],
		replace: true
	});
	return /* @__PURE__ */ jsx(Fragment, { children });
}
//#endregion
//#region src/lazyPages.ts
/** Nạp trang theo route thay vì import tĩnh trong `App.tsx`.
*
*  Trước đây `App.tsx` import tĩnh cả 56 trang nên trình duyệt phải tải toàn
*  bộ cây module của project ngay lần mở đầu tiên (một chunk 1.1 MB). Ở đây
*  mỗi trang là một chunk riêng, chỉ tải khi vào route đó.
*
*  `preloadPages()` dùng cho `check-routes.tsx`: `renderToStaticMarkup` chạy
*  đồng bộ, `lazy` chưa resolve sẽ render ra fallback nên phải nạp trước. */
var loaders = {
	Home: () => import("./assets/Home-BkvgQn6v.js"),
	Blog: () => import("./assets/Blog-Dxzsiara.js"),
	BlogDetail: () => import("./assets/BlogDetail-7vivNE-F.js"),
	Rewards: () => import("./assets/Rewards-CCqM-Ef3.js"),
	LeaderboardPage: () => import("./assets/Leaderboard-CqlnkWqv.js"),
	Scanner: () => import("./assets/Scanner-C0kV91-I.js"),
	MapPage: () => import("./assets/MapPage-C4YxGEam.js"),
	Feedback: () => import("./assets/Feedback-CF5jdA3k.js"),
	Guidance: () => import("./assets/Guidance-BZlKzw_e.js"),
	Waste: () => import("./assets/Waste-CLLbB5Fw.js"),
	Chat: () => import("./assets/Chat-CGcJLbcA.js"),
	JoinRecycler: () => import("./assets/JoinRecycler-DWAkUV5N.js"),
	ResetPassword: () => import("./assets/ResetPassword-ChnsvxWz.js"),
	Terms: () => import("./assets/Terms-C3rZ86P-.js"),
	EcoFactsPage: () => import("./assets/EcoFactsPage-B3VhmT-q.js"),
	Login: () => import("./assets/Login-DMBsv_tR.js"),
	Register: () => import("./assets/Register-XY1mOKAy.js"),
	Logout: () => import("./assets/Logout-94GKkFXl.js"),
	NotFound: () => import("./assets/NotFound-Cuzh8QZo.js"),
	Profile: () => import("./assets/Profile-6Ncaa4JT.js"),
	Password: () => import("./assets/Password-Be5Z8Iia.js"),
	Receipt: () => import("./assets/Receipt-DJhwwjnE.js"),
	Payout: () => import("./assets/Payout-KlXKQCvq.js"),
	Transactions: () => import("./assets/Transactions-JMz1Qc33.js"),
	Gamification: () => import("./assets/Gamification-BPB10JYz.js"),
	RecyclerHome: () => import("./assets/Home-CK_88fqK.js"),
	RecyclerFacility: () => import("./assets/Facility-Ztz4RfEF.js"),
	RecyclerReviews: () => import("./assets/Reviews-C9J14hof.js"),
	RecyclerPackages: () => import("./assets/Packages-B4XO7iDl.js"),
	Requests: () => import("./assets/Requests-BDY0nK-f.js"),
	Catalog: () => import("./assets/Catalog-BTvAk1_j.js"),
	RecyclerReceipt: () => import("./assets/Receipt-paK0auLi.js"),
	StaffHome: () => import("./assets/Home-D1NDGfA-.js"),
	AiReview: () => import("./assets/AiReview-atiakpJA.js"),
	Dataset: () => import("./assets/Dataset-DtmnvFp4.js"),
	Applications: () => import("./assets/Applications-DOhJLHag.js"),
	Complaints: () => import("./assets/Complaints-D9hcyVcQ.js"),
	Accounts: () => import("./assets/Accounts-CPy8iefq.js"),
	BlogEditor: () => import("./assets/BlogEditor-DcrY36bg.js"),
	EcoFacts: () => import("./assets/EcoFacts-swO9yY8k.js"),
	Gifts: () => import("./assets/Gifts-DddCSq-n.js"),
	AdminHome: () => import("./assets/Home-IFm89_eO.js"),
	Reports: () => import("./assets/Reports-Csf2rh_G.js"),
	StaffAccounts: () => import("./assets/StaffAccounts-BimW__QO.js"),
	Permissions: () => import("./assets/Permissions-D_ve80gg.js"),
	BlogReview: () => import("./assets/BlogReview-qPQ_j1HB.js"),
	Categories: () => import("./assets/Categories-Bhsnpz9t.js"),
	Policy: () => import("./assets/Policy-9ixQnzHn.js"),
	GamificationConfig: () => import("./assets/Gamification-6GBTGSvg.js"),
	LeaderboardConfig: () => import("./assets/Leaderboard-DdQE9njx.js"),
	Fees: () => import("./assets/Fees-Cp1_Yzpl.js"),
	Reconciliation: () => import("./assets/Reconciliation-C51Lcc7o.js"),
	AccountProfile: () => import("./assets/AccountProfile-BdHStBoV.js"),
	AccountPassword: () => import("./assets/AccountPassword-Cik13BJz.js")
};
var PAGES = Object.fromEntries(Object.keys(loaders).map((name) => [name, lazy(loaders[name])]));
function preloadPages() {
	return Promise.all(Object.values(loaders).map((load) => load()));
}
//#endregion
//#region src/App.tsx
/** Trang nạp theo route (xem `src/lazyPages.ts`) - không import tĩnh ở đây
*  nữa, để bundle không kéo toàn bộ project vào lần mở đầu tiên. */
var { Home: Home$1, Blog, BlogDetail, Rewards, LeaderboardPage, Scanner, MapPage, Feedback, Guidance, Waste, Chat, JoinRecycler, ResetPassword, Terms, EcoFactsPage, Login, Register, Logout, NotFound, Profile, Password, Receipt: Receipt$1, Payout, Transactions, Gamification, RecyclerHome, RecyclerFacility, RecyclerReviews, RecyclerPackages, Requests, Catalog, RecyclerReceipt, StaffHome, AiReview, Dataset, Applications, Complaints, Accounts, BlogEditor, EcoFacts, Gifts, AdminHome, Reports, StaffAccounts, Permissions, BlogReview, Categories, Policy, GamificationConfig, LeaderboardConfig, Fees, Reconciliation, AccountProfile, AccountPassword } = PAGES;
/** Mọi route sau đăng nhập đều khai báo vai trò được vào. Không có route nào
*  "ai cũng vào được": mọi chức năng đều thuộc đúng một vai trò trong tài
*  liệu use case.
*
*  Tách `AppRoutes` ra khỏi `App` để test được: `check.tsx` render cây route
*  thật với `MemoryRouter`, nếu không thì mọi route đều chỉ được test bằng
*  cách render lẻ từng component — hỏng phần ghép route (RequireRole, Portal,
*  Layout) thì test vẫn xanh. */
function StaffWorkspaceShell() {
	const session = useSession();
	return /* @__PURE__ */ jsx(AdminShell, { role: session?.role === "admin" ? "admin" : "staff" });
}
function ChatWorkspaceLayout() {
	if (useSession()?.role === "recycler") return /* @__PURE__ */ jsx(AdminShell, { role: "recycler" });
	return /* @__PURE__ */ jsx(Layout, {});
}
function GlobalAuthListener() {
	const navigate = useNavigate();
	useEffect(() => {
		const onMessage = (e) => {
			if (e.data?.type === "AUTH_SUCCESS") {
				const session = syncSessionState(e.data?.session);
				const role = e.data?.role || session?.role || "user";
				navigate(role === "user" ? "/" : ROLE_HOME[role] || "/");
			} else if (e.data?.type === "AUTH_LOGOUT") {
				signOut();
				navigate("/");
			}
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [navigate]);
	return null;
}
function AppRoutes() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(GlobalAuthListener, {}), /* @__PURE__ */ jsx(Suspense, {
		fallback: null,
		children: /* @__PURE__ */ jsxs(Routes, { children: [
			/* @__PURE__ */ jsx(Route, {
				path: "/logout",
				element: /* @__PURE__ */ jsx(Logout, {})
			}),
			/* @__PURE__ */ jsx(Route, {
				path: "/reset-password",
				element: /* @__PURE__ */ jsx(ResetPassword, {})
			}),
			/* @__PURE__ */ jsxs(Route, {
				element: /* @__PURE__ */ jsx(AuthLayout, {}),
				children: [/* @__PURE__ */ jsx(Route, {
					path: "/login",
					element: /* @__PURE__ */ jsx(Login, {})
				}), /* @__PURE__ */ jsx(Route, {
					path: "/register",
					element: /* @__PURE__ */ jsx(Register, {})
				})]
			}),
			/* @__PURE__ */ jsxs(Route, {
				element: /* @__PURE__ */ jsx(Layout, {}),
				children: [
					/* @__PURE__ */ jsx(Route, {
						index: true,
						element: /* @__PURE__ */ jsx(Home$1, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "blog",
						element: /* @__PURE__ */ jsx(Blog, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "blog/:slug",
						element: /* @__PURE__ */ jsx(BlogDetail, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "rewards",
						element: /* @__PURE__ */ jsx(Rewards, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "leaderboard",
						element: /* @__PURE__ */ jsx(LeaderboardPage, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "scanner",
						element: /* @__PURE__ */ jsx(Scanner, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "map",
						element: /* @__PURE__ */ jsx(MapPage, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "feedback",
						element: /* @__PURE__ */ jsx(Feedback, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "guidance",
						element: /* @__PURE__ */ jsx(Guidance, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "waste",
						element: /* @__PURE__ */ jsx(Waste, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "join-recycler",
						element: /* @__PURE__ */ jsx(JoinRecycler, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "terms",
						element: /* @__PURE__ */ jsx(Terms, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "ecofacts",
						element: /* @__PURE__ */ jsx(EcoFactsPage, {})
					}),
					/* @__PURE__ */ jsxs(Route, {
						path: "account",
						element: /* @__PURE__ */ jsx(RequireRole, {
							roles: [
								"user",
								"recycler",
								"staff",
								"admin"
							],
							children: /* @__PURE__ */ jsx(Outlet, {})
						}),
						children: [
							/* @__PURE__ */ jsx(Route, {
								path: "profile",
								element: /* @__PURE__ */ jsx(Profile, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "notifications",
								element: /* @__PURE__ */ jsx(Navigate, {
									to: "/account/profile",
									replace: true
								})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "password",
								element: /* @__PURE__ */ jsx(Password, {})
							})
						]
					}),
					/* @__PURE__ */ jsxs(Route, {
						element: /* @__PURE__ */ jsx(RequireRole, {
							roles: ["user"],
							children: /* @__PURE__ */ jsx(Outlet, {})
						}),
						children: [
							/* @__PURE__ */ jsx(Route, {
								path: "user/handover",
								element: /* @__PURE__ */ jsx(Navigate, {
									to: "/chat?newHandover=1",
									replace: true
								})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "user/receipt",
								element: /* @__PURE__ */ jsx(Receipt$1, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "user/payout",
								element: /* @__PURE__ */ jsx(Payout, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "user/subscription",
								element: /* @__PURE__ */ jsx(Payout, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "user/transactions",
								element: /* @__PURE__ */ jsx(Transactions, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "user/gamification",
								element: /* @__PURE__ */ jsx(Gamification, {})
							})
						]
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "*",
						element: /* @__PURE__ */ jsx(NotFound, {})
					})
				]
			}),
			/* @__PURE__ */ jsx(Route, {
				element: /* @__PURE__ */ jsx(RequireRole, {
					roles: ["user", "recycler"],
					children: /* @__PURE__ */ jsx(ChatWorkspaceLayout, {})
				}),
				children: /* @__PURE__ */ jsx(Route, {
					path: "chat",
					element: /* @__PURE__ */ jsx(Chat, {})
				})
			}),
			/* @__PURE__ */ jsxs(Route, {
				path: "/recycler",
				element: /* @__PURE__ */ jsx(RequireRole, {
					roles: ["recycler"],
					children: /* @__PURE__ */ jsx(AdminShell, { role: "recycler" })
				}),
				children: [
					/* @__PURE__ */ jsx(Route, {
						index: true,
						element: /* @__PURE__ */ jsx(RecyclerHome, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "requests",
						element: /* @__PURE__ */ jsx(Requests, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "catalog",
						element: /* @__PURE__ */ jsx(Catalog, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "receipt",
						element: /* @__PURE__ */ jsx(RecyclerReceipt, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "facility",
						element: /* @__PURE__ */ jsx(RecyclerFacility, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "reviews",
						element: /* @__PURE__ */ jsx(RecyclerReviews, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "packages",
						element: /* @__PURE__ */ jsx(RecyclerPackages, {})
					})
				]
			}),
			/* @__PURE__ */ jsxs(Route, {
				path: "/staff",
				element: /* @__PURE__ */ jsx(RequireRole, {
					roles: ["staff", "admin"],
					children: /* @__PURE__ */ jsx(StaffWorkspaceShell, {})
				}),
				children: [
					/* @__PURE__ */ jsx(Route, {
						index: true,
						element: /* @__PURE__ */ jsx(StaffHome, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "ai-review",
						element: /* @__PURE__ */ jsx(AiReview, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "dataset",
						element: /* @__PURE__ */ jsx(Dataset, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "applications",
						element: /* @__PURE__ */ jsx(Applications, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "complaints",
						element: /* @__PURE__ */ jsx(Complaints, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "accounts",
						element: /* @__PURE__ */ jsx(Accounts, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "blog",
						element: /* @__PURE__ */ jsx(BlogEditor, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "ecofacts",
						element: /* @__PURE__ */ jsx(EcoFacts, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "gifts",
						element: /* @__PURE__ */ jsx(Gifts, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "account",
						element: /* @__PURE__ */ jsx(AccountProfile, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "account/password",
						element: /* @__PURE__ */ jsx(AccountPassword, {})
					})
				]
			}),
			/* @__PURE__ */ jsxs(Route, {
				path: "/admin",
				element: /* @__PURE__ */ jsx(RequireRole, {
					roles: ["admin"],
					children: /* @__PURE__ */ jsx(AdminShell, { role: "admin" })
				}),
				children: [
					/* @__PURE__ */ jsx(Route, {
						index: true,
						element: /* @__PURE__ */ jsx(AdminHome, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "reports",
						element: /* @__PURE__ */ jsx(Reports, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "staff",
						element: /* @__PURE__ */ jsx(StaffAccounts, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "permissions",
						element: /* @__PURE__ */ jsx(Permissions, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "blog",
						element: /* @__PURE__ */ jsx(BlogReview, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "categories",
						element: /* @__PURE__ */ jsx(Categories, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "policy",
						element: /* @__PURE__ */ jsx(Policy, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "gamification",
						element: /* @__PURE__ */ jsx(GamificationConfig, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "leaderboard",
						element: /* @__PURE__ */ jsx(LeaderboardConfig, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "fees",
						element: /* @__PURE__ */ jsx(Fees, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "reconciliation",
						element: /* @__PURE__ */ jsx(Reconciliation, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "account",
						element: /* @__PURE__ */ jsx(AccountProfile, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "account/password",
						element: /* @__PURE__ */ jsx(AccountPassword, {})
					})
				]
			})
		] })
	})] });
}
//#endregion
//#region src/check-routes.tsx
/**
* Render CÂY ROUTE THẬT, không render lẻ từng component.
*
*  `check.tsx` render từng page một — nó không bắt được lỗi ở phần ghép route:
*  RequireRole, Portal, Layout, Outlet. Đây là chỗ mấy trang sau đăng nhập
*  chết trắng mà `check.tsx` vẫn xanh.
*
*  localStorage được giả lập để có phiên đăng nhập: server-side không có
*  localStorage nên nếu không giả thì RequireRole đá hết về /login và test
*  thành vô nghĩa.
*/
var store = /* @__PURE__ */ new Map();
globalThis.localStorage = {
	getItem: (k) => store.get(k) ?? null,
	setItem: (k, v) => void store.set(k, v),
	removeItem: (k) => void store.delete(k),
	clear: () => store.clear(),
	key: () => null,
	length: 0
};
/** URL nào kiểm bằng vai trò nào — ở đây chỉ vào các route có RequireRole. */
var BY_ROLE = {
	user: [
		["/user/receipt", "Xác nhận bàn giao rác"],
		["/user/payout", "Quy chuẩn thanh toán tiền phế liệu trực tiếp"],
		["/user/transactions", "Lịch sử biên nhận bàn giao"],
		["/user/gamification", "Cây ảo của bạn"],
		["/chat", "Tạo yêu cầu"]
	],
	recycler: [
		["/recycler", "Tổng quan cơ sở thu mua"],
		["/recycler/requests", "Tiếp nhận yêu cầu bàn giao"],
		["/recycler/catalog", "Danh mục và bảng giá"],
		["/recycler/receipt", "Tạo biên nhận thu gom"],
		["/recycler/facility", "Hồ sơ kho bãi"],
		["/recycler/reviews", "Đánh giá từ người dùng"],
		["/recycler/packages", "Gói dịch vụ"]
	],
	staff: [
		["/staff", "Việc đang chờ bạn xử lý"],
		["/staff/ai-review", "Ảnh AI nhận diện sai"],
		["/staff/dataset", "Tập dữ liệu kiểm chứng"],
		["/staff/applications", "Thẩm định hồ sơ cơ sở thu mua"],
		["/staff/complaints", "Khiếu nại giao dịch"],
		["/staff/accounts", "Danh sách User và Recycler"],
		["/staff/blog", "Soạn bài Blog"],
		["/staff/ecofacts", "Quản lý Eco Fact"],
		["/staff/gifts", "Quà tặng và voucher"],
		["/staff/account", "Việc đang chờ"],
		["/staff/account/password", "Đổi mật khẩu"]
	],
	admin: [
		["/admin", "Dashboard và thống kê"],
		["/admin/reports", "Xuất báo cáo dữ liệu"],
		["/admin/staff", "Tài khoản nhân viên"],
		["/admin/permissions", "Phân quyền nhân viên"],
		["/admin/blog", "Duyệt bài Blog"],
		["/admin/categories", "Danh mục rác hệ thống"],
		["/admin/policy", "Chính sách phân loại rác"],
		["/admin/gamification", "Cấu hình điểm và hạng cây ảo"],
		["/admin/leaderboard", "Chu kỳ bảng xếp hạng"],
		["/admin/fees", "Cấu hình phí giao dịch"],
		["/admin/reconciliation", "Đối soát và dòng tiền"],
		["/admin/account", "Việc đang chờ"],
		["/admin/account/password", "Đổi mật khẩu"]
	]
};
var failed = 0;
await preloadPages();
for (const [role, cases] of Object.entries(BY_ROLE)) {
	signIn("Tài khoản thử", role);
	for (const [path, mustInclude] of cases) try {
		const render = () => renderToStaticMarkup(/* @__PURE__ */ jsx(MemoryRouter, {
			initialEntries: [path],
			children: /* @__PURE__ */ jsx(AppRoutes, {})
		}));
		render();
		await new Promise((resolve) => setTimeout(resolve, 0));
		const html = render();
		const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
		if (text.includes("LỖI 404")) throw new Error("bị chặn sai vai trò");
		if (text.length < 200) throw new Error(`rendered gần như rỗng (${text.length} ký tự)`);
		if (!text.includes(mustInclude)) throw new Error(`thiếu chữ: "${mustInclude}"`);
		console.log(`OK   ${role.padEnd(9)} ${path.padEnd(24)} ${html.length} bytes`);
	} catch (err) {
		failed++;
		console.error(`FAIL ${role.padEnd(9)} ${path.padEnd(24)} ${err.message}`);
	}
}
store.clear();
/**
* Chốt chặn lỗi "Maximum update depth exceeded" — lỗi đã làm TRẮNG MỌI trang
* khi đã đăng nhập, mà cả `check.tsx` lẫn phần render ở trên đều lọt: SSR chỉ
* render một lần nên vòng lặp của `useSyncExternalStore` không xảy ra. Chỉ khi
* đo được danh tính tham chiếu mới bắt được.
*
* `useSyncExternalStore` so `getSnapshot()` bằng `Object.is`. Trả object mới
* mỗi lần gọi là vô hạn vòng render. Đây là bài học rút từ lần này: đổi
* session từ chuỗi sang object mà không nhớ nguyên tắc này là trắng màn hình.
*/
function checkStableSnapshot() {
	const cases = [["đã đăng nhập", () => signIn("Nguyễn Đức", "user")], ["chưa đăng nhập", () => signOut()]];
	for (const [label, setup] of cases) {
		setup();
		if (getSession() !== getSession()) {
			failed++;
			console.error(`FAIL session     ${label.padEnd(24)} getSnapshot() trả object mới mỗi lần gọi -> useSyncExternalStore lặp vô hạn -> trang trắng`);
			return;
		}
		console.log(`OK   session     ${label.padEnd(24)} tham chiếu ổn định`);
	}
}
checkStableSnapshot();
console.log(failed === 0 ? "\nall routes render" : `\n${failed} route failed`);
process.exit(failed === 0 ? 0 : 1);
//#endregion
export {};
