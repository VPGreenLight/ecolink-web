import { C as signIn, O as useSession, T as syncSessionState, d as ROLE_LABEL, g as hasLiveBackendAuth, h as getSession, i as ensureActiveAuthSession, u as ROLE_HOME, w as signOut } from "./assets/api-s1n261eu.js";
import { r as isSsrSmokeTest } from "./assets/hydration-DFDh5R3l.js";
import { r as openAuthPopup } from "./assets/popupAuth-CbEcM25r.js";
import { a as markNotificationRead, i as markAllNotificationsRead, n as createNotificationHubConnection, r as fetchMyNotifications, t as NOTIFICATIONS_UPDATED_EVENT } from "./assets/notificationsApi-blefiHjL.js";
import { o as getAdminReconciliationLedger, v as useEntitlements } from "./assets/servicePackageApi-l8q88aSB.js";
import { m as ConfirmLogoutDialog, o as Portal, p as PORTAL_NAV } from "./assets/Portal-BCYwLxhx.js";
import { a as fetchCurrentUserProfile } from "./assets/authApi-B_RZeGQf.js";
import { t as AI_AVATAR } from "./assets/scanner-DJC07y4s.js";
import { d as POSTS, f as STAFF, h as fmtVnd, i as COMPLAINTS, m as fmtInt, n as AI_CASES, o as DATASET, p as STATS, r as APPLICATIONS } from "./assets/ops-DEQYZm4o.js";
import { t as FLOWS } from "./assets/cashflow-B8HhmFRJ.js";
import { a as fetchAiDatasetDashboard, l as fetchStaffAiFeedbackQueue } from "./assets/aiCurationApi-CKzkMDeL.js";
import { l as fetchStaffBlogs } from "./assets/blogApi-y9RkAsWE.js";
import { c as getAdminKpiSummary, o as getAdminAnalyticsCharts, u as getAdminStaffList } from "./assets/governanceApi-BMnRND9a.js";
import { h as fetchStaffApplications } from "./assets/recyclerWorkflowApi-KrUDy3w0.js";
import { l as fetchStaffComplaints } from "./assets/reviewComplaintApi-BPqoqhtM.js";
import { renderToStaticMarkup } from "react-dom/server";
import { Link, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
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
//#region src/data/nav.ts
var NAV_LINKS = [
	{
		to: "/",
		label: "Tổng quan"
	},
	{
		to: "/scanner",
		label: "Nhận diện AI"
	},
	{
		to: "/map",
		label: "Điểm thu gom"
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
var MOBILE_LINKS = [
	{
		to: "/",
		label: "Tổng quan"
	},
	{
		to: "/scanner",
		label: "Nhận diện"
	},
	{
		to: "/map",
		label: "Thu gom"
	},
	{
		to: "/rewards",
		label: "Đổi thưởng"
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
		{
			label: "Cổng liên kết nhà máy tái chế",
			to: "/partners"
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
			label: "Quy chuẩn vật liệu tái chế",
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
function initialsOf$1(name) {
	return name.split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase();
}
/** Icon người dùng: viewBox cố định nên tỉ lệ đúng ở mọi size, khác với
*  hình tròn + thang vẽ bằng phần trăm trước đây. */
function UserGlyph({ className }) {
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "currentColor",
		"aria-hidden": "true",
		className,
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "8",
			r: "4.25"
		}), /* @__PURE__ */ jsx("path", { d: "M12 13.75c-4.28 0-7.75 2.7-7.75 6.03V21h15.5v-1.22c0-3.33-3.47-6.03-7.75-6.03Z" })]
	});
}
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
function Avatar({ user, avatarUrl, size = "size-9" }) {
	const [imgFailed, setImgFailed] = useState(false);
	useEffect(() => {
		setImgFailed(false);
	}, [avatarUrl]);
	if (avatarUrl && !imgFailed) return /* @__PURE__ */ jsx("img", {
		src: avatarUrl,
		alt: user || "Ảnh đại diện",
		onError: () => setImgFailed(true),
		className: `${size} shrink-0 rounded-full border border-line-soft object-cover`
	});
	if (user) return /* @__PURE__ */ jsx("span", {
		className: `grid ${size} shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#00874a,#004826)] text-[13px] leading-none font-bold tracking-wide text-white`,
		children: initialsOf$1(user)
	});
	return /* @__PURE__ */ jsx("span", {
		className: `grid ${size} shrink-0 place-items-center rounded-full bg-surface-2`,
		children: /* @__PURE__ */ jsx(UserGlyph, { className: "size-1/2 text-sage-line" })
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
var EXPLORE = [
	["/terms", "Điều khoản"],
	["/ecofacts", "Eco Facts"],
	["/partners", "Đối tác tái chế"],
	["/leaderboard", "Xếp hạng người dùng"]
];
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
		className: "relative",
		ref,
		children: [
			/* @__PURE__ */ jsxs("button", {
				type: "button",
				"aria-label": user ? `Tài khoản: ${user}` : "Đăng nhập hoặc đăng ký",
				"aria-haspopup": "menu",
				"aria-expanded": open,
				onClick: () => setOpen((v) => !v),
				className: "flex h-10 items-center gap-1 rounded-full border border-line bg-white px-1 shadow-[0_1px_2px_rgba(15,31,21,0.04)] transition-colors hover:border-sage-line hover:bg-surface-2",
				children: [/* @__PURE__ */ jsx(Avatar, {
					user,
					avatarUrl: session?.avatarUrl,
					size: "size-8"
				}), /* @__PURE__ */ jsx(Chevron, { open })]
			}),
			open && /* @__PURE__ */ jsx("div", {
				role: "menu",
				className: "absolute top-full right-0 mt-2.5 w-[360px] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_48px_-10px_rgba(15,31,21,0.18)]",
				children: user ? /* @__PURE__ */ jsxs(Fragment, { children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-3.5 border-b border-line-soft bg-surface-2/60 px-4 py-3.5",
						children: [/* @__PURE__ */ jsx(Avatar, {
							user,
							avatarUrl: session?.avatarUrl,
							size: "size-11"
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
							session.role === "user" && /* @__PURE__ */ jsxs(Link, {
								to: "/user/payout#citizen-packages",
								onClick: () => setOpen(false),
								className: "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: [/* @__PURE__ */ jsx("span", { children: "Gói dịch vụ & Tắt quảng cáo" }), /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-brand/12 px-2 py-0.5 text-[11px] font-bold text-brand-deep",
									children: entitlements.currentTier
								})]
							}),
							session.role === "recycler" && /* @__PURE__ */ jsxs(Link, {
								to: "/recycler#recycler-packages",
								onClick: () => setOpen(false),
								className: "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: [/* @__PURE__ */ jsx("span", { children: "Gói dịch vụ & Tích xanh Pro" }), /* @__PURE__ */ jsx("span", {
									className: "rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800",
									children: entitlements.currentTier
								})]
							}),
							/* @__PURE__ */ jsxs(Link, {
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
							withRegister: true
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
					className: "ml-auto flex items-center gap-3",
					children: [
						!session && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => openAuthPopup("login"),
							className: "hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep sm:inline-flex",
							children: "Đăng nhập"
						}),
						session && /* @__PURE__ */ jsx(NotificationBellLink, { isLoggedIn: Boolean(session) }),
						/* @__PURE__ */ jsx(AccountMenu$1, {})
					]
				})
			]
		})
	});
}
function NotificationBellLink({ isLoggedIn }) {
	const [unreadCount, setUnreadCount] = useState(0);
	const live = isLoggedIn && !isSsrSmokeTest() && hasLiveBackendAuth();
	useEffect(() => {
		if (!live) {
			setUnreadCount(0);
			return;
		}
		let active = true;
		const syncUnread = () => {
			fetchMyNotifications({
				pageNumber: 1,
				pageSize: 1
			}).then((res) => {
				if (active && res.success && res.data) setUnreadCount(res.data.unreadCount);
			}).catch(() => {});
		};
		syncUnread();
		const onUpdated = (e) => {
			const detail = e.detail;
			if (typeof detail?.unreadCount === "number") {
				setUnreadCount(Math.max(0, detail.unreadCount));
				return;
			}
			if (typeof detail?.delta === "number") {
				setUnreadCount((c) => Math.max(0, c + detail.delta));
				return;
			}
			syncUnread();
		};
		window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdated);
		const connection = createNotificationHubConnection({
			onReceiveNotification: () => {
				if (active) setUnreadCount((c) => c + 1);
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
	return /* @__PURE__ */ jsxs(Link, {
		to: "/account/notifications",
		"aria-label": unreadCount > 0 ? `Thông báo (${unreadCount} chưa đọc)` : "Thông báo",
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
	});
}
//#endregion
//#region src/components/MobileNav.tsx
/** Bottom tab bar, only visible below the `lg` breakpoint. */
function MobileNav() {
	return /* @__PURE__ */ jsx("nav", {
		"aria-label": "Điều hướng chính",
		className: "fixed right-3 bottom-3 left-3 z-50 grid grid-cols-4 overflow-hidden rounded-[14px] border border-line/80 bg-white/94 shadow-[0_8px_28px_rgba(15,31,21,0.14)] backdrop-blur-xl lg:hidden",
		children: MOBILE_LINKS.map((link) => /* @__PURE__ */ jsx(NavLink, {
			to: link.to,
			end: link.to === "/",
			className: ({ isActive }) => `grid min-h-12 place-items-center border-0 border-r border-line/60 px-1 text-xs font-semibold last:border-r-0 ${isActive ? "bg-surface-2 text-brand-deep" : "text-body"}`,
			children: link.label
		}, link.to))
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
//#region src/components/Layout.tsx
/** Khung dùng chung cho mọi trang công khai và portal (hộp thoại đăng nhập/đăng ký Trang Nhỏ được render toàn cục). */
function Layout() {
	const { pathname } = useLocation();
	useEffect(() => {
		window.scrollTo({ top: 0 });
		ensureActiveAuthSession();
	}, [pathname]);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-page pb-20 lg:pb-0",
		children: [
			/* @__PURE__ */ jsx(Navbar, {}),
			/* @__PURE__ */ jsx("main", {
				className: "pt-[70px] md:pt-[76px]",
				children: /* @__PURE__ */ jsx(Suspense, {
					fallback: null,
					children: /* @__PURE__ */ jsx(Outlet, {})
				})
			}),
			/* @__PURE__ */ jsx(Footer, {}),
			/* @__PURE__ */ jsx(MobileNav, {})
		]
	});
}
//#endregion
//#region src/components/admin/Assistant.tsx
var OFFLINE_REPLY = [
	{
		keys: [
			"chờ",
			"hàng đợi",
			"tồn đọng",
			"còn việc"
		],
		answer: () => ({
			text: `Đang có ${AI_CASES.filter((c) => !c.inDataset).length} ảnh AI chờ gán nhãn, ${APPLICATIONS.filter((a) => a.status === "pending").length} hồ sơ đối tác chờ thẩm định, ${COMPLAINTS.filter((c) => c.status !== "resolved").length} khiếu nại chưa xong và ${POSTS.filter((p) => p.status === "pending").length} bài Blog chờ duyệt.`,
			link: {
				to: "/staff/ai-review",
				label: "Mở hàng đợi"
			}
		})
	},
	{
		keys: [
			"sai",
			"chính xác",
			"nhận diện",
			"dataset",
			"tập dữ liệu"
		],
		answer: () => {
			const worst = [...DATASET.byClass].sort((a, b) => a.accuracy - b.accuracy)[0];
			return {
				text: `Độ chính xác trung bình là ${DATASET.accuracy}%. Lớp yếu nhất là ${worst.label} ở ${worst.accuracy}% — đang dưới đường cơ sở.`,
				link: {
					to: "/staff/dataset",
					label: "Mở tập dữ liệu"
				}
			};
		}
	},
	{
		keys: [
			"tiền",
			"doanh thu",
			"phí",
			"dòng tiền",
			"giá trị"
		],
		answer: () => ({
			text: `30 ngày qua giao dịch ${fmtVnd(STATS.gross30d)}, trong đó phí nền tảng thu ${fmtVnd(STATS.fee30d)} trên ${fmtInt(STATS.handovers30d)} giao dịch. Còn ${FLOWS.length} dòng trong sổ đối soát.`,
			link: {
				to: "/admin/reconciliation",
				label: "Mở đối soát"
			}
		})
	},
	{
		keys: [
			"giao dịch",
			"tháng",
			"xu hướng",
			"tăng trưởng"
		],
		answer: () => {
			const [first, last] = [STATS.trend[0], STATS.trend[STATS.trend.length - 1]];
			const growth = (last.handovers - first.handovers) / first.handovers * 100;
			return {
				text: `Giao dịch tăng từ ${fmtInt(first.handovers)} (${first.month}) lên ${fmtInt(last.handovers)} (${last.month}), tức +${growth.toFixed(0)}% trong 6 tháng.`,
				link: {
					to: "/admin",
					label: "Mở dashboard"
				}
			};
		}
	},
	{
		keys: ["khiếu nại", "khiếu nại mới"],
		answer: () => ({
			text: `${COMPLAINTS.filter((c) => c.status === "new").length} khiếu nại mới, ${COMPLAINTS.filter((c) => c.status === "working").length} đang xử lý, ${COMPLAINTS.filter((c) => c.status === "resolved").length} đã xong.`,
			link: {
				to: "/staff/complaints",
				label: "Mở danh sách"
			}
		})
	},
	{
		keys: [
			"nhân viên",
			"staff",
			"quyền",
			"phân quyền"
		],
		answer: () => ({
			text: `Có ${STAFF.length} tài khoản nhân viên, trong đó ${STAFF.filter((s) => s.status === "locked").length} đang bị khoá. Quyền do bạn cấp ở trang phân quyền.`,
			link: {
				to: "/admin/permissions",
				label: "Mở phân quyền"
			}
		})
	}
];
function buildLiveReply(text, snap) {
	const q = text.toLowerCase();
	const hasPerm = (perm) => snap.isAdmin || snap.permissions.has(perm);
	if ([
		"chờ",
		"hàng đợi",
		"tồn đọng",
		"còn việc"
	].some((k) => q.includes(k))) {
		const parts = [];
		if (snap.isAdmin && snap.kpi) {
			parts.push(`${snap.kpi.pending.aiMisclassifiedCases} ảnh AI chờ duyệt`, `${snap.kpi.pending.recyclerApplications} hồ sơ đối tác chờ thẩm định`, `${snap.kpi.pending.openComplaints} khiếu nại đang mở`, `${snap.kpi.pending.pendingBlogPosts} bài Blog chờ duyệt`);
			return {
				text: `Số liệu trực tiếp từ Backend: ${parts.join(", ")}.`,
				link: {
					to: "/staff/ai-review",
					label: "Mở hàng đợi"
				}
			};
		}
		if (hasPerm("REVIEW_AI") && snap.pendingAi !== null) parts.push(`${snap.pendingAi} ảnh AI chờ duyệt`);
		if (hasPerm("VERIFY_RECYCLER") && snap.pendingApps !== null) parts.push(`${snap.pendingApps} hồ sơ đối tác chờ thẩm định`);
		if (hasPerm("HANDLE_COMPLAINT") && snap.complaints) parts.push(`${snap.complaints.openCount + snap.complaints.investigatingCount} khiếu nại đang xử lý`);
		if (hasPerm("MANAGE_BLOG") && snap.pendingBlogs !== null) parts.push(`${snap.pendingBlogs} bài Blog chờ duyệt`);
		if (parts.length > 0) {
			const target = hasPerm("REVIEW_AI") ? "/staff/ai-review" : hasPerm("VERIFY_RECYCLER") ? "/staff/applications" : hasPerm("HANDLE_COMPLAINT") ? "/staff/complaints" : "/staff/blog";
			return {
				text: `Theo quyền của bạn trên Backend: đang có ${parts.join(", ")}.`,
				link: {
					to: target,
					label: "Mở hàng đợi"
				}
			};
		}
		return { text: snap.loaded ? "Chưa có mục hàng đợi nào được phép truy cập hoặc máy chủ không trả dữ liệu." : "Đang tải số liệu hàng đợi từ máy chủ, bạn vui lòng thử hỏi lại sau giây lát." };
	}
	if ([
		"sai",
		"chính xác",
		"nhận diện",
		"dataset",
		"tập dữ liệu"
	].some((k) => q.includes(k))) {
		if (!hasPerm("CURATE_DATASET")) return { text: "Tài khoản của bạn chưa được cấp quyền xem kho dữ liệu AI (CURATE_DATASET)." };
		if (snap.dataset?.summary) {
			const worst = [...snap.dataset.byCategory ?? []].sort((a, b) => a.accuracyPercent - b.accuracyPercent)[0];
			return {
				text: worst ? `Độ chính xác thực nghiệm trên tập kiểm chứng là ${snap.dataset.summary.empiricalAccuracyPercent.toFixed(1)}%. Danh mục yếu nhất là ${worst.categoryName} (${worst.accuracyPercent.toFixed(1)}%).` : `Độ chính xác thực nghiệm là ${snap.dataset.summary.empiricalAccuracyPercent.toFixed(1)}% trên ${fmtInt(snap.dataset.summary.verifiedLabeledCount)} mẫu đã gán nhãn.`,
				link: {
					to: "/staff/dataset",
					label: "Mở tập dữ liệu"
				}
			};
		}
		return { text: "Chưa tải được thống kê tập dữ liệu AI từ Backend." };
	}
	if ([
		"tiền",
		"doanh thu",
		"phí",
		"dòng tiền",
		"giá trị"
	].some((k) => q.includes(k))) {
		if (!snap.isAdmin) return { text: "Số liệu dòng tiền và đối soát gói dịch vụ chỉ hiển thị cho vai trò Admin." };
		if (snap.kpi) {
			const ledgerNote = snap.ledgerCount !== null ? ` Sổ đối soát hiện có ${fmtInt(snap.ledgerCount)} giao dịch gói.` : "";
			return {
				text: `30 ngày qua hệ thống ghi nhận ${fmtVnd(snap.kpi.grossMerchandiseValueVnd)} giá trị thu gom (${fmtInt(snap.kpi.completedHandovers)} giao dịch) và ${fmtVnd(snap.kpi.vietQrServiceRevenueVnd)} doanh thu VietQR.${ledgerNote}`,
				link: {
					to: "/admin/reconciliation",
					label: "Mở đối soát"
				}
			};
		}
		return { text: "Chưa tải được báo cáo tài chính từ Backend." };
	}
	if ([
		"giao dịch",
		"tháng",
		"xu hướng",
		"tăng trưởng"
	].some((k) => q.includes(k))) {
		if (!snap.isAdmin) return { text: "Biểu đồ tăng trưởng toàn hệ thống thuộc quyền xem của Admin." };
		const trends = snap.charts?.monthlyTrends ?? [];
		if (trends.length >= 2) {
			const first = trends[0];
			const last = trends[trends.length - 1];
			const pct = first.completedHandovers > 0 ? ` (${((last.completedHandovers - first.completedHandovers) / first.completedHandovers * 100).toFixed(0)}%)` : "";
			return {
				text: `Giao dịch hoàn tất biến động từ ${fmtInt(first.completedHandovers)} (${first.monthLabel}) tới ${fmtInt(last.completedHandovers)} (${last.monthLabel})${pct}.`,
				link: {
					to: "/admin",
					label: "Mở dashboard"
				}
			};
		}
		if (trends.length === 1) return {
			text: `Kỳ gần nhất (${trends[0].monthLabel}) ghi nhận ${fmtInt(trends[0].completedHandovers)} giao dịch hoàn tất.`,
			link: {
				to: "/admin",
				label: "Mở dashboard"
			}
		};
		return { text: "Chưa có đủ dữ liệu xu hướng theo tháng từ Backend." };
	}
	if (["khiếu nại", "khiếu nại mới"].some((k) => q.includes(k))) {
		if (!hasPerm("HANDLE_COMPLAINT")) return { text: "Tài khoản của bạn chưa được cấp quyền xử lý khiếu nại (HANDLE_COMPLAINT)." };
		if (snap.complaints) return {
			text: `Hiện có ${snap.complaints.openCount} khiếu nại mới mở, ${snap.complaints.investigatingCount} đang điều tra và ${snap.complaints.resolvedCount} đã giải quyết.`,
			link: {
				to: "/staff/complaints",
				label: "Mở danh sách"
			}
		};
		return { text: "Chưa tải được danh sách khiếu nại từ Backend." };
	}
	if ([
		"nhân viên",
		"staff",
		"quyền",
		"phân quyền"
	].some((k) => q.includes(k))) {
		if (!snap.isAdmin) return { text: "Quản lý tài khoản nhân viên và phân quyền thuộc thẩm quyền Admin." };
		if (snap.staff) {
			const locked = snap.staff.filter((s) => s.status.toUpperCase() !== "ACTIVE").length;
			return {
				text: `Hệ thống có ${snap.staff.length} tài khoản nhân viên, trong đó ${locked} tài khoản đang tạm khóa hoặc không hoạt động.`,
				link: {
					to: "/admin/permissions",
					label: "Mở phân quyền"
				}
			};
		}
		return { text: "Chưa tải được danh sách nhân viên từ Backend." };
	}
	return { text: "Mình chỉ tra được số liệu thật đang mở trên console. Hãy hỏi về việc chờ, độ chính xác AI, dòng tiền, xu hướng giao dịch, khiếu nại hoặc nhân viên." };
}
function Assistant() {
	const [open, setOpen] = useState(false);
	const [msgs, setMsgs] = useState([{
		id: 1,
		from: "ai",
		text: "Chào, mình đọc được số liệu console này. Hỏi tôi về việc chờ, độ chính xác AI, dòng tiền hoặc nhân viên."
	}]);
	const [draft, setDraft] = useState("");
	const end = useRef(null);
	const liveAuth = !isSsrSmokeTest() && hasLiveBackendAuth();
	const session = getSession();
	const isAdmin = session?.role === "admin";
	const [snap, setSnap] = useState(() => ({
		loaded: false,
		isAdmin,
		permissions: new Set(session?.permissions ?? []),
		kpi: null,
		charts: null,
		dataset: null,
		staff: null,
		ledgerCount: null,
		complaints: null,
		pendingAi: null,
		pendingApps: null,
		pendingBlogs: null
	}));
	const chips = useMemo(() => isAdmin || !liveAuth ? [
		"Còn việc gì chờ?",
		"AI chính xác bao nhiêu?",
		"Tiền tháng này thế nào?"
	] : [
		"Còn việc gì chờ?",
		"AI chính xác bao nhiêu?",
		"Khiếu nại hiện tại?"
	], [isAdmin, liveAuth]);
	useEffect(() => {
		if (!liveAuth || !open || snap.loaded) return;
		let active = true;
		const s = getSession();
		const roleIsAdmin = s?.role === "admin";
		const perms = new Set(s?.permissions ?? []);
		const can = (perm) => roleIsAdmin || s?.role === "staff" && perms.has(perm);
		async function loadLive() {
			const next = {
				loaded: true,
				isAdmin: roleIsAdmin,
				permissions: perms,
				kpi: null,
				charts: null,
				dataset: null,
				staff: null,
				ledgerCount: null,
				complaints: null,
				pendingAi: null,
				pendingApps: null,
				pendingBlogs: null
			};
			const tasks = [];
			if (roleIsAdmin) tasks.push(getAdminKpiSummary("30d").then((r) => {
				if (r.success && r.data) next.kpi = r.data;
			}).catch(() => {}), getAdminAnalyticsCharts().then((r) => {
				if (r.success && r.data) next.charts = r.data;
			}).catch(() => {}), getAdminStaffList().then((r) => {
				if (r.success && Array.isArray(r.data)) next.staff = r.data;
			}).catch(() => {}), getAdminReconciliationLedger({
				pageNumber: 1,
				pageSize: 1
			}).then((r) => {
				if (r.success && r.data?.items) next.ledgerCount = r.data.items.totalRecords;
			}).catch(() => {}));
			if (can("CURATE_DATASET")) tasks.push(fetchAiDatasetDashboard().then((r) => {
				if (r.success && r.data) next.dataset = r.data;
			}).catch(() => {}));
			if (can("HANDLE_COMPLAINT")) tasks.push(fetchStaffComplaints({
				pageSize: 1,
				includeReportedReviews: false
			}).then((r) => {
				if (r.success && r.data) next.complaints = r.data;
			}).catch(() => {}));
			if (!roleIsAdmin && can("REVIEW_AI")) tasks.push(fetchStaffAiFeedbackQueue({ pageSize: 1 }).then((r) => {
				if (r.success && r.data) next.pendingAi = r.data.pendingCount;
			}).catch(() => {}));
			if (!roleIsAdmin && can("VERIFY_RECYCLER")) tasks.push(fetchStaffApplications().then((r) => {
				next.pendingApps = r.items.filter((a) => a.status === "pending").length;
			}).catch(() => {}));
			if (!roleIsAdmin && can("MANAGE_BLOG")) tasks.push(fetchStaffBlogs({
				status: "Pending_Approval",
				pageSize: 1
			}).then((r) => {
				if (r.success && r.data) next.pendingBlogs = r.data.totalCount;
			}).catch(() => {}));
			await Promise.allSettled(tasks);
			if (active) setSnap(next);
		}
		loadLive();
		return () => {
			active = false;
		};
	}, [
		liveAuth,
		open,
		snap.loaded
	]);
	useEffect(() => {
		end.current?.scrollIntoView({ block: "end" });
	}, [msgs, open]);
	const send = (text) => {
		const t = text.trim();
		if (!t) return;
		const q = t.toLowerCase();
		const ans = liveAuth ? buildLiveReply(t, snap) : OFFLINE_REPLY.find((r) => r.keys.some((k) => q.includes(k)))?.answer() ?? { text: "Mình chỉ tra được số liệu đang mở trên console. Hãy hỏi về việc chờ, độ chính xác AI, dòng tiền, xu hướng giao dịch, khiếu nại hoặc nhân viên." };
		setMsgs((ms) => [
			...ms,
			{
				id: ms.length + 1,
				from: "me",
				text: t
			},
			{
				id: ms.length + 2,
				from: "ai",
				...ans
			}
		]);
		setDraft("");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "fixed right-4 bottom-4 z-50 flex flex-col items-end gap-3",
		children: [open && /* @__PURE__ */ jsxs("div", {
			className: "flex h-[26rem] w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_-16px_rgba(15,31,21,0.28)]",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3 border-b border-line-soft px-4 py-3",
					children: [
						/* @__PURE__ */ jsx("img", {
							src: "/assets/AI/ecolink-ai-avatar.webp",
							alt: "",
							className: "size-12 shrink-0 object-contain",
							loading: "lazy"
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate text-[13px] font-bold text-ink",
								children: "Trợ lý EcoLink"
							}), /* @__PURE__ */ jsx("p", {
								className: "text-[11px] text-muted",
								children: "Đọc số liệu trong console"
							})]
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setOpen(false),
							className: "ml-auto grid size-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink",
							children: [/* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 24 24",
								className: "size-4",
								fill: "none",
								stroke: "currentColor",
								strokeWidth: "1.8",
								strokeLinecap: "round",
								"aria-hidden": "true",
								children: /* @__PURE__ */ jsx("path", { d: "m6 6 12 12M18 6 6 18" })
							}), /* @__PURE__ */ jsx("span", {
								className: "sr-only",
								children: "Đóng trợ lý"
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex-1 space-y-2.5 overflow-y-auto px-4 py-3",
					children: [
						msgs.map((m) => /* @__PURE__ */ jsx("div", {
							className: m.from === "me" ? "flex justify-end" : "",
							children: /* @__PURE__ */ jsxs("div", {
								className: `max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-5 ${m.from === "me" ? "bg-brand text-white" : "bg-surface-2 text-body"}`,
								children: [m.text, m.link && /* @__PURE__ */ jsxs(Link, {
									to: m.link.to,
									onClick: () => setOpen(false),
									className: `mt-1.5 block text-[12px] font-semibold underline underline-offset-2 ${m.from === "me" ? "text-white" : "text-brand"}`,
									children: [m.link.label, " →"]
								})]
							})
						}, m.id)),
						msgs.length === 1 && /* @__PURE__ */ jsx("div", {
							className: "flex flex-wrap gap-1.5 pt-1",
							children: chips.map((c) => /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => send(c),
								className: "rounded-full border border-line px-2.5 py-1 text-[12px] text-body transition-colors hover:bg-surface-2 hover:text-ink",
								children: c
							}, c))
						}),
						/* @__PURE__ */ jsx("div", { ref: end })
					]
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: (e) => {
						e.preventDefault();
						send(draft);
					},
					className: "flex gap-2 border-t border-line-soft p-3",
					children: [/* @__PURE__ */ jsx("input", {
						className: "input h-9 flex-1 text-[13px]",
						value: draft,
						onChange: (e) => setDraft(e.target.value),
						placeholder: "Hỏi về số liệu console...",
						"aria-label": "Câu hỏi cho trợ lý"
					}), /* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-9 shrink-0 px-3.5 text-[13px]",
						children: "Gửi"
					})]
				})
			]
		}), /* @__PURE__ */ jsx("button", {
			type: "button",
			onClick: () => setOpen((v) => !v),
			"aria-expanded": open,
			"aria-label": open ? "Đóng trợ lý" : "Mở trợ lý EcoLink",
			className: "grid size-16 place-items-center rounded-full bg-white shadow-[0_12px_28px_-8px_rgba(15,31,21,0.34)] ring-1 ring-line transition-transform hover:scale-105 active:scale-95",
			children: /* @__PURE__ */ jsx("img", {
				src: AI_AVATAR,
				alt: "",
				className: "size-full scale-110 object-contain",
				loading: "lazy"
			})
		})]
	});
}
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
	staff: [["/staff/account", "Hồ sơ và thông báo"], ["/staff/account/password", "Đổi mật khẩu"]],
	admin: [["/admin/account", "Hồ sơ và thông báo"], ["/admin/account/password", "Đổi mật khẩu"]]
};
/** Khung riêng cho hai vai trò làm việc trong hệ thống: STAFF và ADMIN.
*
*  CỐ TÌNH không dùng `Layout` của app công khai: đây là công cụ vận hành, không
*  phải một trang trong app của người dân. Dùng chung khung thì nó mặc navbar
*  bán hàng, tab-bar điều hướng và footer của người dùng — cả ba đều không liên
*  quan tới việc thẩm định dữ liệu hay cấu hình hệ thống.
*
*  Khác biệt nhìn thấy được ngay:
*  - không có navbar công khai, không có footer, không có thanh tab dưới
*  - thanh trên cố định 56px (thấp hơn navbar 76px) để nhường chỗ cho dữ liệu
*  - sidebar 232px, dùng chung bề rộng cho mọi trang nên khi đổi trang
*    nội dung không nhảy
*  - sidebar TỰ CUỘN, không cuộn cả trang: `<aside>` `sticky` chiếm đúng
*    chiều cao khung nhìn, trong đó `<nav>` cuộn và nút Đăng xuất đứng yên ở
*    đáy. Nếu để nút trong dòng cuộn của nav thì nó trôi mất khi trang dài.
*
*  Menu đọc từ `PORTAL_NAV[role]` nên staff và admin dùng chung component,
*  chỉ khác con trỏ ngữ cảnh (role) và nhãn badge. */
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
					className: "flex h-full items-center gap-3 px-4 lg:px-6",
					children: [
						/* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setOpen((v) => !v),
							"aria-expanded": open,
							"aria-controls": "admin-nav",
							className: "grid size-9 place-items-center rounded-lg text-ink transition-colors hover:bg-surface-2 lg:hidden",
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
						/* @__PURE__ */ jsx("img", {
							src: "/assets/brand/logo1.png",
							alt: "EcoLink",
							className: "h-7 w-auto"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "rounded-md bg-brand/10 px-2 py-1 text-[11px] font-bold tracking-[0.1em] text-brand uppercase",
							children: ROLE_LABEL[role]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "ml-auto flex items-center gap-2.5",
							children: [/* @__PURE__ */ jsx(NotificationBellPopover, { role }), /* @__PURE__ */ jsx(AccountMenu, {
								name: session?.name ?? "",
								label: ROLE_LABEL[role],
								items: ACCOUNT_ITEMS[role]
							})]
						})
					]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex",
				children: [/* @__PURE__ */ jsxs("aside", {
					className: "flex w-58 shrink-0 flex-col border-r border-line-soft bg-white lg:sticky lg:top-14 lg:h-[calc(100dvh-3.5rem)]",
					children: [/* @__PURE__ */ jsx("nav", {
						id: "admin-nav",
						"aria-label": "Điều hướng khu vực quản trị",
						className: `${open ? "block" : "hidden"} lg:block lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4 lg:py-6`,
						children: navSections.map((sec) => /* @__PURE__ */ jsxs("div", {
							className: "px-4 pb-5 lg:px-0",
							children: [/* @__PURE__ */ jsx("h2", {
								className: "px-3 text-[11px] font-bold tracking-[0.12em] text-brand uppercase",
								children: sec.title
							}), /* @__PURE__ */ jsx("ul", {
								className: "mt-1.5 flex flex-col gap-0.5",
								children: sec.items.map((item) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(NavLink, {
									to: item.to,
									end: item.to.split("/").length <= 2,
									className: ({ isActive }) => `block rounded-md px-3 py-2 text-[13px] leading-5 font-medium transition-colors ${isActive ? "bg-brand text-white" : "text-body hover:bg-surface-2 hover:text-ink"}`,
									children: item.label
								}) }, item.to))
							})]
						}, sec.title))
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: logout,
						className: "mx-4 mb-4 w-[calc(100%-2rem)] shrink-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-800 lg:mt-auto",
						children: "Đăng xuất"
					})]
				}), /* @__PURE__ */ jsx("main", {
					className: "min-w-0 flex-1 px-4 py-6 lg:px-8 lg:py-8",
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
									className: "btn-primary inline-flex h-10 items-center px-4 text-xs font-semibold",
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
			/* @__PURE__ */ jsx(Assistant, {}),
			/* @__PURE__ */ jsx(ConfirmLogoutDialog, {
				open: confirmLogout,
				onClose: () => setConfirmLogout(false),
				onConfirm: handleConfirmLogout,
				userName: session?.name
			})
		]
	});
}
function initialsOf(name) {
	return name.split(" ").slice(-2).map((part) => part[0]).join("").toUpperCase();
}
/** Avatar + menu tài khoản ở thanh trên.
*
*  Menu tài khoản KHÔNG nằm trong sidebar: sidebar là danh sách màn hình của
*  khu vực làm việc, trộn 2 mục tài khoản dùng chung vào đó thì không phân biệt
*  được đâu là việc công việc, đâu là việc của chính mình. Ở đây nó nằm sau
*  avatar, đúng chỗ của nó ở mọi app khác. */
function AccountMenu({ name, label, items }) {
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
			className: "flex items-center gap-1.5 rounded-full border border-line bg-white py-1 pr-2 pl-1 transition-colors hover:border-sage-line hover:bg-surface-2",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "grid size-8 place-items-center rounded-full bg-[linear-gradient(145deg,#00874a,#004826)] text-[12px] leading-none font-bold tracking-wide text-white",
					children: initialsOf(name)
				}),
				/* @__PURE__ */ jsx("span", {
					className: "hidden text-[13px] text-muted sm:block",
					children: name
				}),
				/* @__PURE__ */ jsx("svg", {
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
				})
			]
		}), open && /* @__PURE__ */ jsxs("div", {
			role: "menu",
			className: "absolute top-full right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.16)]",
			children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center gap-3 border-b border-line-soft bg-surface-2/60 p-4",
				children: [/* @__PURE__ */ jsx("span", {
					className: "grid size-11 shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#00874a,#004826)] text-sm leading-none font-bold tracking-wide text-white",
					children: initialsOf(name)
				}), /* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsx("p", {
						className: "truncate text-sm font-bold text-ink",
						children: name
					}), /* @__PURE__ */ jsx("p", {
						className: "text-xs text-muted",
						children: label
					})]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "p-2",
				children: [items.map(([to, item]) => /* @__PURE__ */ jsxs(Link, {
					to,
					onClick: () => setOpen(false),
					className: "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-body transition-colors hover:bg-surface-2 hover:text-ink",
					children: [/* @__PURE__ */ jsxs("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
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
					className: "mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 hover:text-red-800",
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
			className: "relative grid size-9 place-items-center rounded-full border border-line bg-white text-muted transition-colors hover:border-sage-line hover:bg-surface-2 hover:text-ink",
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
			className: "absolute top-full right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_18px_44px_-8px_rgba(15,31,21,0.18)] sm:w-96",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex items-center justify-between border-b border-line-soft bg-surface-2/70 px-4 py-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm font-bold text-ink",
						children: "Thông báo hệ thống"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-[11px] text-muted",
						children: unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : "Đã đọc tất cả"
					})] }), live && unreadCount > 0 && /* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: busyAll,
						onClick: () => void handleMarkAll(),
						className: "text-xs font-semibold text-brand-deep hover:underline disabled:opacity-50",
						children: busyAll ? "Đang xử lý..." : "Đọc tất cả"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "max-h-80 overflow-y-auto divide-y divide-line-soft",
					children: [err && /* @__PURE__ */ jsx("p", {
						role: "alert",
						className: "px-4 py-2.5 text-xs font-medium text-warn",
						children: err
					}), !live ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-xs text-muted",
						children: "Kết nối tài khoản Backend để nhận thông báo thời gian thực."
					}) : loading && items.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-xs text-muted",
						children: "Đang tải thông báo..."
					}) : items.length === 0 ? /* @__PURE__ */ jsx("p", {
						className: "px-4 py-6 text-center text-xs text-muted",
						children: "Chưa có thông báo nào."
					}) : items.map((n) => /* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: () => void handleMarkOne(n),
						className: `flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface-2 ${n.isRead ? "bg-white" : "bg-brand/5"}`,
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-xs font-bold text-ink",
									children: n.title
								}), !n.isRead && /* @__PURE__ */ jsx("span", {
									className: "mt-1 size-2 shrink-0 rounded-full bg-brand",
									"aria-hidden": "true"
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "text-xs leading-5 text-body",
								children: n.message
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-[11px] text-muted tabular-nums",
								children: new Date(n.createdAt).toLocaleString("vi-VN")
							})
						]
					}, n.id))]
				}),
				/* @__PURE__ */ jsx("div", {
					className: "border-t border-line-soft bg-surface-2/40 px-4 py-2.5 text-right",
					children: /* @__PURE__ */ jsx(Link, {
						to: `/${role}/account`,
						onClick: () => setOpen(false),
						className: "text-xs font-semibold text-brand-deep hover:underline",
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
	Home: () => import("./assets/Home-k8NQ6yEO.js"),
	Blog: () => import("./assets/Blog-DAmbu5nB.js"),
	BlogDetail: () => import("./assets/BlogDetail-BMwW6G0K.js"),
	Rewards: () => import("./assets/Rewards-Djmud8sc.js"),
	LeaderboardPage: () => import("./assets/Leaderboard-CCLSKTqq.js"),
	Scanner: () => import("./assets/Scanner-BaVOVU4R.js"),
	MapPage: () => import("./assets/MapPage-DLJW8nJv.js"),
	Partners: () => import("./assets/Partners-BWm033tw.js"),
	Feedback: () => import("./assets/Feedback-D2aS4pOs.js"),
	Guidance: () => import("./assets/Guidance-B64HhuCr.js"),
	Waste: () => import("./assets/Waste-C3Xvf9nX.js"),
	Chat: () => import("./assets/Chat-BJG_CC2X.js"),
	JoinRecycler: () => import("./assets/JoinRecycler-DaBpanVk.js"),
	ResetPassword: () => import("./assets/ResetPassword-CfDS2T_e.js"),
	Terms: () => import("./assets/Terms-D_XrPq_m.js"),
	EcoFactsPage: () => import("./assets/EcoFactsPage-BBmqhcpy.js"),
	Login: () => import("./assets/Login-DZBXboIG.js"),
	Register: () => import("./assets/Register-BGU-5WwP.js"),
	Logout: () => import("./assets/Logout-rhaiOvHH.js"),
	NotFound: () => import("./assets/NotFound-Cuzh8QZo.js"),
	Profile: () => import("./assets/Profile-BolPmVSM.js"),
	Notifications: () => import("./assets/Notifications-Dq0idcdj.js"),
	Password: () => import("./assets/Password-CCfwnswD.js"),
	UserHome: () => import("./assets/Home-C5FWynUA.js"),
	Handover: () => import("./assets/Handover-CSO7jsos.js"),
	Receipt: () => import("./assets/Receipt-DXgn33pg.js"),
	Payout: () => import("./assets/Payout-yGmJynFN.js"),
	Transactions: () => import("./assets/Transactions-Cpejq_Wi.js"),
	Gamification: () => import("./assets/Gamification-Dxznwx52.js"),
	RecyclerHome: () => import("./assets/Home-DHFRsPtz.js"),
	Requests: () => import("./assets/Requests-CdSCfJ8I.js"),
	Catalog: () => import("./assets/Catalog-ynK0XlfG.js"),
	RecyclerReceipt: () => import("./assets/Receipt-KPgOM7Er.js"),
	StaffHome: () => import("./assets/Home-ChPdSLwr.js"),
	AiReview: () => import("./assets/AiReview-Cgi88xei.js"),
	Dataset: () => import("./assets/Dataset-C8lc6PPD.js"),
	Applications: () => import("./assets/Applications-5Qj3lal-.js"),
	Complaints: () => import("./assets/Complaints-B8Ya5uyn.js"),
	Accounts: () => import("./assets/Accounts-CPDPaftY.js"),
	BlogEditor: () => import("./assets/BlogEditor--KCnYcGl.js"),
	EcoFacts: () => import("./assets/EcoFacts-DFpy_N-E.js"),
	Gifts: () => import("./assets/Gifts-BBGeHOYF.js"),
	StaffCheckIn: () => import("./assets/CheckIn-DMew8Zhj.js"),
	AdminHome: () => import("./assets/Home-hl3j4qUK.js"),
	Reports: () => import("./assets/Reports-5rwfrv9a.js"),
	StaffAccounts: () => import("./assets/StaffAccounts-B14WXELa.js"),
	Permissions: () => import("./assets/Permissions-BKnoyY5X.js"),
	BlogReview: () => import("./assets/BlogReview-B5bZfrqy.js"),
	Categories: () => import("./assets/Categories-CTK5j1f-.js"),
	Policy: () => import("./assets/Policy-CrolMlMo.js"),
	GamificationConfig: () => import("./assets/Gamification-n8pLUCV9.js"),
	LeaderboardConfig: () => import("./assets/Leaderboard-B8aN3fQ2.js"),
	Fees: () => import("./assets/Fees-BqchdO3v.js"),
	Reconciliation: () => import("./assets/Reconciliation-Di-M7C2g.js"),
	AccountProfile: () => import("./assets/AccountProfile-DY_fDlJP.js"),
	AccountPassword: () => import("./assets/AccountPassword-DZlQkZSj.js")
};
var PAGES = Object.fromEntries(Object.keys(loaders).map((name) => [name, lazy(loaders[name])]));
function preloadPages() {
	return Promise.all(Object.values(loaders).map((load) => load()));
}
//#endregion
//#region src/App.tsx
/** Trang nạp theo route (xem `src/lazyPages.ts`) - không import tĩnh ở đây
*  nữa, để bundle không kéo toàn bộ project vào lần mở đầu tiên. */
var { Home, Blog, BlogDetail, Rewards, LeaderboardPage, Scanner, MapPage, Partners, Feedback, Guidance, Waste, Chat, JoinRecycler, ResetPassword, Terms, EcoFactsPage, Login, Register, Logout, NotFound, Profile, Notifications, Password, UserHome, Handover, Receipt, Payout, Transactions, Gamification, RecyclerHome, Requests, Catalog, RecyclerReceipt, StaffHome, AiReview, Dataset, Applications, Complaints, Accounts, BlogEditor, EcoFacts, Gifts, StaffCheckIn, AdminHome, Reports, StaffAccounts, Permissions, BlogReview, Categories, Policy, GamificationConfig, LeaderboardConfig, Fees, Reconciliation, AccountProfile, AccountPassword } = PAGES;
/** Mọi route sau đăng nhập đều khai báo vai trò được vào. Không có route nào
*  "ai cũng vào được": mọi chức năng đều thuộc đúng một vai trò trong tài
*  liệu use case.
*
*  Tách `AppRoutes` ra khỏi `App` để test được: `check.tsx` render cây route
*  thật với `MemoryRouter`, nếu không thì mọi route đều chỉ được test bằng
*  cách render lẻ từng component — hỏng phần ghép route (RequireRole, Portal,
*  Layout) thì test vẫn xanh. */
function RolePortal() {
	const session = useSession();
	return /* @__PURE__ */ jsx(Portal, { role: session?.role === "recycler" ? "recycler" : "user" });
}
function StaffWorkspaceShell() {
	const session = useSession();
	return /* @__PURE__ */ jsx(AdminShell, { role: session?.role === "admin" ? "admin" : "staff" });
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
						element: /* @__PURE__ */ jsx(Home, {})
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
						path: "partners",
						element: /* @__PURE__ */ jsx(Partners, {})
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
								element: /* @__PURE__ */ jsx(Notifications, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "password",
								element: /* @__PURE__ */ jsx(Password, {})
							})
						]
					}),
					/* @__PURE__ */ jsx(Route, {
						element: /* @__PURE__ */ jsx(RequireRole, {
							roles: ["user", "recycler"],
							children: /* @__PURE__ */ jsx(RolePortal, {})
						}),
						children: /* @__PURE__ */ jsx(Route, {
							path: "chat",
							element: /* @__PURE__ */ jsx(Chat, {})
						})
					}),
					/* @__PURE__ */ jsx(Route, {
						element: /* @__PURE__ */ jsx(RequireRole, {
							roles: ["user"],
							children: /* @__PURE__ */ jsx(Portal, { role: "user" })
						}),
						children: /* @__PURE__ */ jsxs(Route, {
							path: "user",
							children: [
								/* @__PURE__ */ jsx(Route, {
									index: true,
									element: /* @__PURE__ */ jsx(UserHome, {})
								}),
								/* @__PURE__ */ jsx(Route, {
									path: "handover",
									element: /* @__PURE__ */ jsx(Handover, {})
								}),
								/* @__PURE__ */ jsx(Route, {
									path: "receipt",
									element: /* @__PURE__ */ jsx(Receipt, {})
								}),
								/* @__PURE__ */ jsx(Route, {
									path: "payout",
									element: /* @__PURE__ */ jsx(Payout, {})
								}),
								/* @__PURE__ */ jsx(Route, {
									path: "subscription",
									element: /* @__PURE__ */ jsx(Payout, {})
								}),
								/* @__PURE__ */ jsx(Route, {
									path: "transactions",
									element: /* @__PURE__ */ jsx(Transactions, {})
								}),
								/* @__PURE__ */ jsx(Route, {
									path: "gamification",
									element: /* @__PURE__ */ jsx(Gamification, {})
								})
							]
						})
					}),
					/* @__PURE__ */ jsx(Route, {
						element: /* @__PURE__ */ jsx(RequireRole, {
							roles: ["recycler"],
							children: /* @__PURE__ */ jsx(Portal, { role: "recycler" })
						}),
						children: /* @__PURE__ */ jsxs(Route, {
							path: "recycler",
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
								})
							]
						})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "*",
						element: /* @__PURE__ */ jsx(NotFound, {})
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
						path: "checkin",
						element: /* @__PURE__ */ jsx(StaffCheckIn, {})
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
		["/user", "Xin chào"],
		["/user/handover", "Yêu cầu thu gom rác"],
		["/user/receipt", "Xác nhận bàn giao rác"],
		["/user/payout", "Quy chuẩn thanh toán tiền phế liệu trực tiếp"],
		["/user/transactions", "Lịch sử biên nhận bàn giao"],
		["/user/gamification", "Cây ảo của bạn"],
		["/chat", "Tạo yêu cầu bàn giao"]
	],
	recycler: [
		["/recycler", "Trạng thái hoạt động"],
		["/recycler/requests", "Tiếp nhận yêu cầu bàn giao"],
		["/recycler/catalog", "Danh mục và bảng giá"],
		["/recycler/receipt", "Tạo biên nhận thu gom"]
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
		["/staff/checkin", "Điểm danh hằng ngày"],
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
