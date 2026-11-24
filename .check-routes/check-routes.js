import { C as signIn, D as useSession, d as ROLE_LABEL, h as getSession, i as ensureActiveAuthSession, u as ROLE_HOME, w as signOut } from "./assets/api-BcucRD7x.js";
import { a as useAuthModalMode, i as openAuthPopup, t as closeAuthModal } from "./assets/popupAuth-B0QM-H-V.js";
import { t as AuthForm } from "./assets/AuthForm-DOk6ca7Z.js";
import { v as useEntitlements } from "./assets/servicePackageApi-CS25DpPC.js";
import { m as ConfirmLogoutDialog, o as Portal, p as PORTAL_NAV } from "./assets/Portal-CyX9Rhh0.js";
import { t as AI_AVATAR } from "./assets/scanner-DJC07y4s.js";
import { d as POSTS, f as STAFF, h as fmtVnd, i as COMPLAINTS, m as fmtInt, n as AI_CASES, o as DATASET, p as STATS, r as APPLICATIONS } from "./assets/ops-DEQYZm4o.js";
import { n as FLOWS } from "./assets/cashflow-CHqRtMGy.js";
import { renderToStaticMarkup } from "react-dom/server";
import { Link, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/components/CompactAuthModal.tsx
/** Hộp thoại Đăng nhập / Đăng ký Trang Nhỏ thống nhất trên toàn ứng dụng. */
function CompactAuthModal() {
	const mode = useAuthModalMode();
	useEffect(() => {
		if (!mode || typeof document === "undefined") return;
		const onKeyDown = (e) => {
			if (e.key === "Escape") closeAuthModal();
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [mode]);
	if (!mode) return null;
	return /* @__PURE__ */ jsx("div", {
		className: "fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/45 p-4 backdrop-blur-[2px]",
		role: "dialog",
		"aria-modal": "true",
		"aria-label": mode === "register" ? "Tạo tài khoản EcoLink" : "Đăng nhập EcoLink",
		onMouseDown: (e) => {
			if (e.target === e.currentTarget) closeAuthModal();
		},
		children: /* @__PURE__ */ jsx("div", {
			className: "my-auto w-full max-w-[420px]",
			children: /* @__PURE__ */ jsx(AuthForm, {
				mode,
				onClose: closeAuthModal
			}, mode)
		})
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
		"Nhận diện tự động qua Camera",
		"Sàn giao dịch phế liệu GPS",
		"Cổng liên kết nhà máy tái chế",
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
function Avatar({ user, size = "size-9" }) {
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
var ACCOUNT_ITEMS$1 = [
	{
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
	},
	{
		to: "/account/notifications",
		label: "Thông báo",
		icon: /* @__PURE__ */ jsxs("svg", {
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.8",
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
			className: "size-4 text-muted",
			children: [/* @__PURE__ */ jsx("path", { d: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" }), /* @__PURE__ */ jsx("path", { d: "M10.3 21a1.94 1.94 0 0 0 3.4 0" })]
		})
	},
	{
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
	}
];
/** Mục Khám phá: dùng lại cho cả khách và người đã đăng nhập. `register` chỉ
*  hiện khi đã đăng nhập — U-05 là bước nâng cấp từ tài khoản người dân lên
*  cơ sở thu mua, người chưa có tài khoản thì chưa ở trong hệ sinh thái. */
var EXPLORE = [
	["/terms", "Điều khoản"],
	["/ecofacts", "Eco Facts"],
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
	useEffect(() => {
		const onMessage = (e) => {
			if (e.data?.type === "AUTH_SUCCESS") {
				const role = e.data.role;
				navigate(role === "user" ? "/" : ROLE_HOME[role] || "/");
			} else if (e.data?.type === "AUTH_LOGOUT") navigate("/");
		};
		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [navigate]);
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
						/* @__PURE__ */ jsxs("span", {
							className: "hidden h-10 items-center gap-1.5 text-xs whitespace-nowrap text-body md:flex",
							children: [/* @__PURE__ */ jsx("i", { className: "size-1.5 rounded-full bg-brand-soft shadow-[0_0_0_3px_rgba(0,112,61,0.12)]" }), "Hà Nội"]
						}),
						!session && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => openAuthPopup("login"),
							className: "hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep sm:inline-flex",
							children: "Đăng nhập"
						}),
						/* @__PURE__ */ jsx(AccountMenu$1, {})
					]
				})
			]
		})
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
var REPLY = [
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
var CHIPS = [
	"Còn việc gì chờ?",
	"AI chính xác bao nhiêu?",
	"Tiền tháng này thế nào?"
];
function reply(text) {
	const q = text.toLowerCase();
	return REPLY.find((r) => r.keys.some((k) => q.includes(k)))?.answer() ?? { text: "Mình chỉ tra được số liệu đang mở trên console. Hãi hỏi về việc chờ, độ chính xác AI, dòng tiền, xu hướng giao dịch, khiếu nại hoặc nhân viên." };
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
	useEffect(() => {
		end.current?.scrollIntoView({ block: "end" });
	}, [msgs, open]);
	const send = (text) => {
		const t = text.trim();
		if (!t) return;
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
				...reply(t)
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
							children: CHIPS.map((c) => /* @__PURE__ */ jsx("button", {
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
	const [open, setOpen] = useState(false);
	const [confirmLogout, setConfirmLogout] = useState(false);
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
						/* @__PURE__ */ jsx("div", {
							className: "ml-auto",
							children: /* @__PURE__ */ jsx(AccountMenu, {
								name: session?.name ?? "",
								label: ROLE_LABEL[role],
								items: ACCOUNT_ITEMS[role]
							})
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
						children: PORTAL_NAV[role].map((sec) => /* @__PURE__ */ jsxs("div", {
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
					children: /* @__PURE__ */ jsx(Suspense, {
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
//#endregion
//#region src/components/RequireRole.tsx
/** Chốt chặn route theo vai trò. Chưa đăng nhập -> về trang chủ / và mở hộp thoại đăng nhập nhỏ,
*  đã đăng nhập sai vai trò -> về trang chủ của vai trò đó, đồng thời đối chiếu Cookie với Backend. */
function RequireRole({ roles, children }) {
	const session = useSession();
	const sessionIdentity = session ? `${session.id ?? session.username ?? session.name}:${session.role}` : null;
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!sessionIdentity) {
			openAuthPopup("login");
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
	Home: () => import("./assets/Home-AlJHO5uZ.js"),
	Blog: () => import("./assets/Blog-CvMD6XIz.js"),
	BlogDetail: () => import("./assets/BlogDetail-BI4opNVn.js"),
	Rewards: () => import("./assets/Rewards-bZ42L3ed.js"),
	LeaderboardPage: () => import("./assets/Leaderboard-BGW0HBg5.js"),
	Scanner: () => import("./assets/Scanner-BiqoUbIa.js"),
	MapPage: () => import("./assets/MapPage-DCq3HOXF.js"),
	Partners: () => import("./assets/Partners-CIZrTiBM.js"),
	Feedback: () => import("./assets/Feedback--UKw-4Gy.js"),
	Guidance: () => import("./assets/Guidance-w6H09biY.js"),
	Waste: () => import("./assets/Waste-hF-kZG7T.js"),
	Chat: () => import("./assets/Chat-DFYEpzP4.js"),
	JoinRecycler: () => import("./assets/JoinRecycler-D83vGm3L.js"),
	ResetPassword: () => import("./assets/ResetPassword-BXY1Z8CK.js"),
	Terms: () => import("./assets/Terms-BFbBVb9e.js"),
	EcoFactsPage: () => import("./assets/EcoFactsPage-Dp83Nblb.js"),
	Login: () => import("./assets/Login-5zEWyX6i.js"),
	Register: () => import("./assets/Register-CwO23xID.js"),
	Logout: () => import("./assets/Logout-CoqF1jLT.js"),
	NotFound: () => import("./assets/NotFound-Cuzh8QZo.js"),
	Profile: () => import("./assets/Profile-P4-an5Md.js"),
	Notifications: () => import("./assets/Notifications-8p_KzkQG.js"),
	Password: () => import("./assets/Password-CVwGZpRG.js"),
	UserHome: () => import("./assets/Home-ASqNVj-J.js"),
	Handover: () => import("./assets/Handover-Dz3okOxp.js"),
	Receipt: () => import("./assets/Receipt-C61UuC0c.js"),
	Payout: () => import("./assets/Payout-BPC0-gTi.js"),
	Transactions: () => import("./assets/Transactions-Cse0vUXX.js"),
	Gamification: () => import("./assets/Gamification-CVqfv_6n.js"),
	RecyclerHome: () => import("./assets/Home-H-jCjBZn.js"),
	Requests: () => import("./assets/Requests-C9OpDxG3.js"),
	Catalog: () => import("./assets/Catalog-yfAbVkfi.js"),
	RecyclerReceipt: () => import("./assets/Receipt-D9cX575l.js"),
	StaffHome: () => import("./assets/Home-Bbhr4438.js"),
	AiReview: () => import("./assets/AiReview-BelVBB2X.js"),
	Dataset: () => import("./assets/Dataset-BX3nKwoL.js"),
	Applications: () => import("./assets/Applications-BMy-h3En.js"),
	Complaints: () => import("./assets/Complaints-CbtqabWG.js"),
	Accounts: () => import("./assets/Accounts-B8F34lxl.js"),
	BlogEditor: () => import("./assets/BlogEditor-Dzsw03g7.js"),
	EcoFacts: () => import("./assets/EcoFacts-D4xisVx7.js"),
	Gifts: () => import("./assets/Gifts-BpBbwYOu.js"),
	StaffCheckIn: () => import("./assets/CheckIn-CI7cLTUI.js"),
	AdminHome: () => import("./assets/Home-B-qACwe-.js"),
	Reports: () => import("./assets/Reports-ruYFo5Pk.js"),
	StaffAccounts: () => import("./assets/StaffAccounts-kzJn2fj5.js"),
	Permissions: () => import("./assets/Permissions-YD37drcw.js"),
	BlogReview: () => import("./assets/BlogReview-CG2akN1p.js"),
	Categories: () => import("./assets/Categories-BejtZzXP.js"),
	Policy: () => import("./assets/Policy-Bm06hDMN.js"),
	GamificationConfig: () => import("./assets/Gamification-C76rUceX.js"),
	LeaderboardConfig: () => import("./assets/Leaderboard-Bx-zK2G4.js"),
	Fees: () => import("./assets/Fees-CJBVrkgF.js"),
	Reconciliation: () => import("./assets/Reconciliation-Cx7z6DH8.js"),
	AccountProfile: () => import("./assets/AccountProfile-D0fZtBPh.js"),
	AccountPassword: () => import("./assets/AccountPassword-C2af9Dr6.js")
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
function AppRoutes() {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Suspense, {
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
				element: /* @__PURE__ */ jsx(Layout, {}),
				children: [
					/* @__PURE__ */ jsx(Route, {
						path: "login",
						element: /* @__PURE__ */ jsx(Login, {})
					}),
					/* @__PURE__ */ jsx(Route, {
						path: "register",
						element: /* @__PURE__ */ jsx(Register, {})
					}),
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
					roles: ["staff"],
					children: /* @__PURE__ */ jsx(AdminShell, { role: "staff" })
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
	}), /* @__PURE__ */ jsx(CompactAuthModal, {})] });
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
		["/user/payout", "Tài khoản nhận tiền"],
		["/user/transactions", "Lịch sử tiền vào tài khoản"],
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
