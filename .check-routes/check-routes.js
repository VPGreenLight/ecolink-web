import { renderToStaticMarkup } from "react-dom/server";
import { Link, MemoryRouter, NavLink, Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
//#region src/lib/session.ts
var ROLE_LABEL = {
	user: "Người dân",
	recycler: "Cơ sở thu mua",
	staff: "Nhân viên",
	admin: "Quản trị viên"
};
/** Trang chủ sau khi đăng nhập, theo vai trò. */
var ROLE_HOME = {
	user: "/user",
	recycler: "/recycler",
	staff: "/staff",
	admin: "/admin"
};
var KEY$1 = "ecolink:user";
var listeners = /* @__PURE__ */ new Set();
var emit = () => listeners.forEach((l) => l());
/** Bộ nhớ đệm của getSnapshot.
*
*  BẮT BUỘC phải có. `useSyncExternalStore` so sánh kết quả của `getSnapshot`
*  bằng `Object.is`: nếu mỗi lần gọi đều trả về object MỚI thì luôn khác
*  nhau, React coi là đã đổi rồi render lại, lại gọi, lại khác... đến khi vượt
*  "Maximum update depth exceeded" và **dựng lại cả cây — trang trắng**.
*
*  Trước đây `session.ts` trả về một CHUỖI, primitive nên `Object.is` ổn định
*  và không có vòng lặp. Đổi sang object mà quên chuyện này là nguyên nhân trang
*  trắng — và nó xảy ra ở MỌI trang khi đã đăng nhập, vì navbar gọi
*  `useSession()` trên khắp app chứ không riêng trang quản trị. */
var cached = null;
var primed = false;
function readSession() {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(KEY$1);
		if (!raw) return null;
		const v = JSON.parse(raw);
		if (typeof v?.name !== "string") return null;
		return {
			name: v.name,
			role: ROLE_LABEL[v.role] ? v.role : "user"
		};
	} catch {
		return null;
	}
}
/** Bỏ đệm để lần đọc kế tiếp nạp lại từ localStorage. */
function invalidate() {
	cached = null;
	primed = false;
}
function getSession() {
	if (!primed) {
		cached = readSession();
		primed = true;
	}
	return cached;
}
function signIn(name, role = "user") {
	localStorage.setItem(KEY$1, JSON.stringify({
		name,
		role
	}));
	invalidate();
	emit();
}
function signOut() {
	localStorage.removeItem(KEY$1);
	invalidate();
	emit();
}
function subscribe(onChange) {
	listeners.add(onChange);
	const onStorage = () => {
		invalidate();
		onChange();
	};
	window.addEventListener("storage", onStorage);
	return () => {
		listeners.delete(onChange);
		window.removeEventListener("storage", onStorage);
	};
}
/** phiên hiện tại, hoặc null khi chưa đăng nhập. */
function useSession() {
	return useSyncExternalStore(subscribe, getSession, getSession);
}
/** Tên hiển thị, hoặc "" khi chưa đăng nhập. */
function useUser() {
	return useSession()?.name ?? "";
}
function useRole() {
	return useSession()?.role ?? null;
}
//#endregion
//#region src/lib/popupAuth.ts
/** Kiểm tra trang hiện tại có đang chạy trong Browser Popup Window hay không */
function isAuthPopup() {
	if (typeof window === "undefined") return false;
	return new URLSearchParams(window.location.search).get("popup") === "1" || Boolean(window.opener);
}
/** Mở Browser Popup Window ở chính giữa màn hình người dùng */
function openAuthPopup(mode = "login") {
	if (typeof window === "undefined") return null;
	const width = 480;
	const height = 660;
	const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
	const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
	const url = `/${mode}?popup=1`;
	const popup = window.open(url, "EcoLinkAuthPopup", `width=${width},height=${height},left=${left},top=${top},status=no,menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes`);
	if (popup) popup.focus();
	else window.location.href = url;
	return popup;
}
//#endregion
//#region src/components/ConfirmLogoutDialog.tsx
function ConfirmLogoutDialog({ open, onClose, onConfirm, userName }) {
	const [mounted, setMounted] = useState(false);
	useEffect(() => {
		setMounted(true);
	}, []);
	useEffect(() => {
		if (!open) return;
		const onKey = (e) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onClose]);
	if (!open) return null;
	const content = /* @__PURE__ */ jsx("div", {
		role: "dialog",
		"aria-modal": "true",
		"aria-labelledby": "logout-dialog-title",
		className: "fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs",
		onClick: onClose,
		children: /* @__PURE__ */ jsxs("div", {
			className: "w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center shadow-2xl",
			onClick: (e) => e.stopPropagation(),
			children: [
				/* @__PURE__ */ jsx("div", {
					className: "mx-auto mb-3.5 grid size-12 place-items-center rounded-full bg-red-50 text-red-600",
					children: /* @__PURE__ */ jsx("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						className: "size-6",
						stroke: "currentColor",
						strokeWidth: "2",
						"aria-hidden": "true",
						children: /* @__PURE__ */ jsx("path", {
							d: "M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h9",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})
				}),
				/* @__PURE__ */ jsx("h2", {
					id: "logout-dialog-title",
					className: "text-base font-bold text-ink",
					children: "Xác nhận đăng xuất"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm text-muted",
					children: userName ? `Bạn có chắc chắn muốn đăng xuất tài khoản "${userName}" không?` : "Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc này?"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-6 flex items-center gap-3",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onClose,
						className: "h-10 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-body transition-colors hover:bg-surface-2 cursor-pointer",
						children: "Hủy bỏ"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: onConfirm,
						className: "h-10 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-700 cursor-pointer",
						children: "Đăng xuất"
					})]
				})
			]
		})
	});
	if (mounted && typeof document !== "undefined") return createPortal(content, document.body);
	return content;
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
		"Hướng dẫn phân loại rác nguồn",
		"Quy chuẩn vật liệu tái chế",
		"Chính sách quyền riêng tư",
		"Điều khoản dịch vụ môi trường"
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
							children: [/* @__PURE__ */ jsx("i", { className: "size-1.5 rounded-full bg-brand-soft shadow-[0_0_0_3px_rgba(0,112,61,0.12)]" }), "TP. Hồ Chí Minh"]
						}),
						/* @__PURE__ */ jsx(Link, {
							to: "/map",
							className: "hidden h-10 items-center rounded-full bg-brand px-4 text-sm font-semibold whitespace-nowrap text-white shadow-[0_5px_14px_rgba(0,112,61,0.22)] transition-colors hover:bg-brand-deep sm:inline-flex",
							children: "Tìm người thu gom"
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
								children: [/* @__PURE__ */ jsx("i", { className: "size-2.5 rounded-full bg-mint" }), "100% Cam kết minh bạch dữ liệu"]
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
			}) }, typeof item === "string" ? item : item.to))
		})
	] });
}
//#endregion
//#region src/components/Layout.tsx
/** Chrome shared by every public page. Auth pages render `AuthLayout` instead. */
function Layout() {
	const { pathname } = useLocation();
	useEffect(() => {
		window.scrollTo({ top: 0 });
	}, [pathname]);
	return /* @__PURE__ */ jsxs("div", {
		className: "min-h-dvh bg-page pb-20 lg:pb-0",
		children: [
			/* @__PURE__ */ jsx(Navbar, {}),
			/* @__PURE__ */ jsx("main", {
				className: "pt-[70px] md:pt-[76px]",
				children: /* @__PURE__ */ jsx(Outlet, {})
			}),
			/* @__PURE__ */ jsx(Footer, {}),
			/* @__PURE__ */ jsx(MobileNav, {})
		]
	});
}
//#endregion
//#region src/components/AuthLayout.tsx
/** Ba việc app thật sự làm, không bịa thêm tính năng */
var PERKS = [
	{
		title: "Nhận diện bằng AI",
		body: "Chụp ảnh rác, biết vật liệu và giá tham khảo trong vài giây.",
		icon: "scan"
	},
	{
		title: "Thu gom tận nhà",
		body: "Đặt lịch người thu gom gần bạn và theo dõi lộ trình.",
		icon: "pin"
	},
	{
		title: "Nối chuỗi giá trị",
		body: "Kết nối trực tiếp với nhà máy tái chế đạt chuẩn.",
		icon: "recycle"
	}
];
var stroke$5 = {
	stroke: "currentColor",
	strokeWidth: 1.6,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function PerkIcon({ name }) {
	const box = "size-[18px]";
	if (name === "scan") return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: box,
		children: [/* @__PURE__ */ jsx("path", {
			d: "M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5a2.5 2.5 0 0 1-2.5 2.5H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16",
			...stroke$5
		}), /* @__PURE__ */ jsx("path", {
			d: "M3 12h18",
			...stroke$5
		})]
	});
	if (name === "pin") return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: box,
		children: [/* @__PURE__ */ jsx("path", {
			d: "M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z",
			...stroke$5
		}), /* @__PURE__ */ jsx("circle", {
			cx: "12",
			cy: "10",
			r: "2.5",
			...stroke$5
		})]
	});
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: box,
		children: [/* @__PURE__ */ jsx("path", {
			d: "m8 4 3 3-2 2a4 4 0 0 0 5 5l2-2 3 3-2 2",
			...stroke$5
		}), /* @__PURE__ */ jsx("path", {
			d: "M4.5 8.5 7 6M14 18l2.5-2.5",
			...stroke$5
		})]
	});
}
/** Khung layout dùng chung cho Login & Register.
*  Panel hình ảnh bên trái cố định, không unmount hay giật nháy khi chuyển form qua lại.
*/
function AuthLayout() {
	if (isAuthPopup()) return /* @__PURE__ */ jsx("div", {
		className: "flex min-h-dvh flex-col justify-center bg-page px-6 py-8",
		children: /* @__PURE__ */ jsx("main", {
			className: "mx-auto w-full max-w-[420px]",
			children: /* @__PURE__ */ jsx(Outlet, {})
		})
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "grid min-h-dvh bg-page lg:grid-cols-2",
		children: [/* @__PURE__ */ jsxs("aside", {
			className: "relative hidden flex-col justify-between overflow-hidden bg-[#052b18] p-10 text-white lg:col-start-1 lg:row-start-1 lg:flex xl:p-14",
			children: [
				/* @__PURE__ */ jsx("img", {
					src: "/assets/auth/leaves.jpg",
					alt: "",
					"aria-hidden": "true",
					className: "absolute inset-0 size-full object-cover object-[50%_18%] brightness-[0.6] saturate-[1.25]"
				}),
				/* @__PURE__ */ jsx("span", {
					className: "relative text-xs font-semibold tracking-[0.22em] text-mint uppercase",
					children: "Hệ sinh thái tuần hoàn"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "relative -my-8 max-w-[440px]",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-[clamp(28px,2.6vw,38px)] font-bold tracking-tight leading-[1.18]",
							children: "Chụp ảnh rác. Biết vật liệu. Người thu gom tới tận nhà."
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-5 text-[15px] leading-[1.7] text-white/70",
							children: "EcoLink nối người dân với người thu gom và nhà máy tái chế trong một nền tảng duy nhất."
						}),
						/* @__PURE__ */ jsx("ul", {
							className: "mt-9 flex flex-col gap-5",
							children: PERKS.map((perk) => /* @__PURE__ */ jsxs("li", {
								className: "flex items-start gap-3.5",
								children: [/* @__PURE__ */ jsx("span", {
									className: "grid size-9 shrink-0 place-items-center rounded-full bg-white/12 text-mint",
									children: /* @__PURE__ */ jsx(PerkIcon, { name: perk.icon })
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
									className: "text-sm font-semibold",
									children: perk.title
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-[13px] leading-[1.55] text-white/60",
									children: perk.body
								})] })]
							}, perk.title))
						})
					]
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "relative flex items-baseline gap-3 border-t border-white/15 pt-6",
					children: [/* @__PURE__ */ jsx("b", {
						className: "text-3xl font-bold tracking-tight",
						children: "12.4k"
					}), /* @__PURE__ */ jsx("span", {
						className: "text-[13px] text-white/60",
						children: "tấn phế liệu đã số hoá qua EcoLink"
					})]
				})
			]
		}), /* @__PURE__ */ jsx("main", {
			className: "flex flex-col justify-center px-6 py-12 lg:col-start-2 lg:row-start-1 lg:px-10 xl:px-14",
			children: /* @__PURE__ */ jsx(Outlet, {})
		})]
	});
}
//#endregion
//#region src/data/portal.ts
var ACCOUNT = [{
	to: "/account/profile",
	label: "Hồ sơ và thông báo"
}, {
	to: "/account/password",
	label: "Đổi mật khẩu"
}];
var PORTAL_NAV = {
	user: [
		{
			title: "Tài khoản",
			items: [
				{
					to: "/user",
					label: "Tổng quan"
				},
				{
					to: "/user/handover",
					label: "Yêu cầu bàn giao"
				},
				{
					to: "/user/receipt",
					label: "Xác nhận biên nhận"
				},
				{
					to: "/user/payout",
					label: "Tài khoản nhận tiền"
				},
				{
					to: "/user/transactions",
					label: "Lịch sử dòng tiền"
				}
			]
		},
		{
			title: "Phân loại rác",
			items: [
				{
					to: "/scanner",
					label: "Nhận diện bằng AI"
				},
				{
					to: "/guidance",
					label: "Hướng dẫn phân loại"
				},
				{
					to: "/waste",
					label: "Tra cứu loại rác"
				},
				{
					to: "/rewards",
					label: "Đổi thưởng và điểm danh"
				},
				{
					to: "/user/gamification",
					label: "Cây ảo và Eco Fact"
				}
			]
		},
		{
			title: "Khác",
			items: [
				{
					to: "/chat",
					label: "Chatbox thương lượng"
				},
				{
					to: "/feedback",
					label: "Khiếu nại và góp ý"
				},
				...ACCOUNT
			]
		}
	],
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
				to: "/recycler/catalog",
				label: "Danh mục và bảng giá"
			},
			{
				to: "/recycler/receipt",
				label: "Biên nhận thu gom"
			}
		]
	}, {
		title: "Khác",
		items: [{
			to: "/chat",
			label: "Chatbox thương lượng"
		}, ...ACCOUNT]
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
					label: "Tài khoản User/Buyer"
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
				},
				{
					to: "/staff/checkin",
					label: "Điểm danh nhân viên"
				}
			]
		},
		{
			title: "Khác",
			items: ACCOUNT
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
//#region src/components/Portal.tsx
/** Khung chung cho 4 vai trò sau đăng nhập: sidebar điều hướng + tiêu đề.
*
*  Sidebar ẩn dưới `lg` thay vì có drawer: các màn hình sau đăng nhập đều dùng
*  bảng và biểu mẫu, người dùng chủ yếu ở desktop. Ở mobile hiện thanh cuộn
*  ngang ở đầu trang — 4 mục trở xuống vẫn bấm được. */
function Portal({ role }) {
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
		className: "flex min-h-[calc(100dvh-70px)] flex-col md:min-h-[calc(100dvh-76px)]",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "border-b border-line bg-white lg:hidden",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "page flex items-center gap-3 py-3",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setOpen((v) => !v),
						"aria-expanded": open,
						"aria-controls": "portal-nav",
						className: "btn-ghost h-10 shrink-0 px-3 text-[13px]",
						children: open ? "Đóng" : "Menu"
					}), /* @__PURE__ */ jsxs("p", {
						className: "min-w-0 truncate text-sm font-bold text-ink",
						children: [
							session?.name,
							" · ",
							ROLE_LABEL[role]
						]
					})]
				}), open && /* @__PURE__ */ jsx("nav", {
					id: "portal-nav",
					className: "page flex flex-col gap-4 pb-4",
					children: PORTAL_NAV[role].map((sec) => /* @__PURE__ */ jsx(Section, {
						title: sec.title,
						role
					}, sec.title))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "page flex flex-1 gap-8 py-6 lg:py-8",
				children: [/* @__PURE__ */ jsx("aside", {
					className: "hidden w-56 shrink-0 lg:block",
					children: /* @__PURE__ */ jsxs("div", {
						className: "sticky top-24",
						children: [
							/* @__PURE__ */ jsxs("p", {
								className: "rounded-lg border border-line bg-surface-2 px-3 py-2.5",
								children: [/* @__PURE__ */ jsx("span", {
									className: "block truncate text-sm font-bold text-ink",
									children: session?.name ?? "Khách"
								}), /* @__PURE__ */ jsx("span", {
									className: "block text-xs text-muted",
									children: ROLE_LABEL[role]
								})]
							}),
							/* @__PURE__ */ jsx("nav", {
								"aria-label": "Điều hướng khu vực",
								className: "mt-4",
								children: PORTAL_NAV[role].map((sec) => /* @__PURE__ */ jsx(Section, {
									title: sec.title,
									role
								}, sec.title))
							}),
							/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: logout,
								className: "mt-6 w-full rounded-lg border border-sage-line px-3 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-surface-2",
								children: "Đăng xuất"
							})
						]
					})
				}), /* @__PURE__ */ jsx("main", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ jsx(Outlet, {})
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
function Section({ title, role }) {
	const items = PORTAL_NAV[role].find((s) => s.title === title)?.items ?? [];
	return /* @__PURE__ */ jsxs("div", {
		className: "mb-5",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "px-3 text-[13px] font-bold tracking-[0.12em] text-brand uppercase",
			children: title
		}), /* @__PURE__ */ jsx("ul", {
			className: "mt-1.5 flex flex-col gap-0.5",
			children: items.map((item) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx(NavLink, {
				to: item.to,
				end: item.to.split("/").length <= 2,
				className: ({ isActive }) => `block rounded-lg px-3 py-2 text-[13px] leading-5 font-medium transition-colors ${isActive ? "bg-brand/10 text-brand-deep" : "text-body hover:bg-surface-2 hover:text-ink"}`,
				children: item.label
			}) }, item.to))
		})]
	});
}
/** Tiêu đề trang dùng chung cho mọi màn hình sau đăng nhập: eyebrow + h1 +
*  mô tả. Mô tả nói việc người dùng làm được ở đây, không lặp lại tên menu. */
function PageHead$1({ eyebrow, title, body, action }) {
	return /* @__PURE__ */ jsxs("header", {
		className: "flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "min-w-0",
			children: [
				eyebrow && /* @__PURE__ */ jsx("p", {
					className: "eyebrow",
					children: eyebrow
				}),
				/* @__PURE__ */ jsx("h1", {
					className: "display mt-1.5 text-[24px] leading-8 md:text-[28px] md:leading-9",
					children: title
				}),
				body && /* @__PURE__ */ jsx("p", {
					className: "mt-2 max-w-[68ch] text-sm leading-6 text-body",
					children: body
				})
			]
		}), action]
	});
}
/** Ô số liệu.
*
*  KHÔNG viền 1px xám. Trước đây mỗi số liệu là một hộp `card` có viền, đặt
*  cạnh nhau thành dãy 4 hộp giống hệt nhau — đúng cái "identical card grid"
*  mà luật thiết kế cấm: nó toát ra "AI làm" và ăn chỗ trống của dữ liệu. Thay
*  bằng khoảng trắng và bóng đổ rất mềm.
*
*  `unit` tách riêng khỏi `value` vì lý do thị giác: "214.500 kg" gộp chung
*  làm con số dài ra ngang với "1.842.000.000", cả hàng lệch nhau. Để đơn vị
*  thành chữ nhỏ mảnh đi, các số cùng cỡ và đọc thành một hàng.
*
*  `note` vẫn giữ vì vài trang dùng; trang nào không cần thì đừng truyền —
*  ba dòng chữ ở ba cỡ trong một ô làm rối. */
function Stat$1({ label, value, unit, note, tone = "plain" }) {
	const onBrand = tone === "brand";
	return /* @__PURE__ */ jsxs("div", {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: `text-[11px] font-semibold tracking-[0.1em] uppercase ${onBrand ? "text-brand" : "text-muted"}`,
				children: label
			}),
			/* @__PURE__ */ jsxs("p", {
				className: `mt-1.5 flex items-baseline gap-1.5 font-bold tracking-tight ${onBrand ? "text-[26px] leading-9 xl:text-[28px]" : "text-2xl leading-8"} text-ink`,
				children: [/* @__PURE__ */ jsx("span", {
					className: "tabular-nums",
					children: value
				}), unit && /* @__PURE__ */ jsx("span", {
					className: `text-sm font-semibold ${onBrand ? "text-brand-deep" : "text-muted"}`,
					children: unit
				})]
			}),
			note && /* @__PURE__ */ jsx("p", {
				className: "mt-1 text-[13px] leading-5 text-muted",
				children: note
			})
		]
	});
}
/** Khung bảng dữ liệu: tiêu đề cột + nội dung. Bọc trong `overflow-x-auto` ở
*  nơi dùng vì bảng rộng hơn màn hình trên mobile. */
function Table$1({ head, children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "overflow-x-auto rounded-xl border border-line bg-surface",
		children: /* @__PURE__ */ jsxs("table", {
			className: "w-full min-w-[640px] border-collapse text-left text-sm",
			children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", {
				className: "border-b border-line bg-surface-2",
				children: head.map((h) => /* @__PURE__ */ jsx("th", {
					scope: "col",
					className: "px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
					children: h
				}, h))
			}) }), /* @__PURE__ */ jsx("tbody", {
				className: "divide-y divide-line-soft",
				children
			})]
		})
	});
}
function Td$1({ children, className = "" }) {
	return /* @__PURE__ */ jsx("td", {
		className: `px-4 py-3 align-top text-body ${className}`,
		children
	});
}
/** Nhãn trạng thái. Chỉ một hệ màu xanh như phần còn lại của app: mức độ
*  đậm nhạt phân biệt trạng thái, không thêm màu đỏ/vàng. */
function Status$1({ tone, children }) {
	const cls = {
		todo: "bg-surface-3 text-body",
		wait: "bg-mint/25 text-brand-deep",
		ok: "bg-brand text-white",
		off: "bg-surface-2 text-muted"
	}[tone];
	return /* @__PURE__ */ jsx("span", {
		className: `inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${cls}`,
		children
	});
}
/** Khối "chưa có gì" — dùng thay cho danh sách rỗng. */
function Empty({ children }) {
	return /* @__PURE__ */ jsx("p", {
		className: "card px-5 py-8 text-center text-sm leading-6 text-muted",
		children
	});
}
/** Trường biểu mẫu: nhãn + control + gợi ý. Bọc <label> thật nên bàn phím
*  chuyển vòng qua các ô bằng Tab là tự động. */
function Field$2({ label, hint, children }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
		children: [
			label,
			children,
			hint && /* @__PURE__ */ jsx("span", {
				className: "text-[12px] font-normal text-muted",
				children: hint
			})
		]
	});
}
//#endregion
//#region src/data/scanner.ts
var SCAN_RESULT = {
	image: "/assets/scanner/b7b43.png",
	imageCaption: "Hình ảnh: Chai nhựa trong suốt 500ml",
	tag: "Nhựa PET (#1)",
	confidence: 92,
	material: "Chai nhựa PET",
	badge: "Vật liệu có giá trị",
	description: "Dễ thu gom, có khả năng tái sinh tuần hoàn cao thành sợi hoặc chai mới.",
	price: {
		label: "ĐƠN GIÁ THAM KHẢO",
		value: "4.500 – 6.000",
		unit: "đ / kg"
	},
	model: "Mô hình phân loại ResNet-V2",
	/** token tên, không phải hex: đổi bảng màu là cả trang đổi theo */
	breakdown: [
		{
			label: "Chai nhựa (PET)",
			value: 92,
			color: "var(--color-brand)"
		},
		{
			label: "Chai thủy tinh",
			value: 5,
			color: "var(--color-mint)"
		},
		{
			label: "Khác",
			value: 3,
			color: "var(--color-sage-line)"
		}
	],
	steps: ["Đổ sạch chất lỏng và tráng sơ bằng nước sạch.", "Tháo rời nắp chai và giẫm ép dẹp để tiết kiệm diện tích."]
};
/** Ba GIF robot AI của bạn — đúng MỘT ẢNH CHO MỖI TRẠNG THÁI:
*  normal (chờ) / scan (đang quét) / done (đã có kết quả).
*
*  Đã bỏ nền và nén bằng ffmpeg. File gốc có NỀN HỒNG #FE01FD từ frame 2 trở
*  đi (chỉ frame 0 trong suốt) — lỗi khi xuất, không phải chủ ý. WebP giữ
*  alpha thật nên `colorkey` bỏ sạch; đi qua GIF thì pipeline
*  palettegen/paletteuse của ffmpeg nuốt mất alpha.
*
*    ecolink-ai-normal.gif  5221KB -> ecolink-ai-normal.webp  1360KB  (giảm 74%)
*    ecolink-ai-scan.gif    9357KB -> ecolink-ai-scan.webp    2558KB  (giảm 73%)
*    ecolink-ai-done.gif    5090KB -> ecolink-ai-done.webp    1228KB  (giảm 76%)
*
*  Lệnh đã dùng cho từng file:
*    ffmpeg -i <ten>.gif -vf "colorkey=0xFE01FD:0.3:0.2" \
*           -c:v libwebp -lossless 0 -quality 72 -loop 0 -an <ten>.webp
*
*  File gốc GIF vẫn giữ nguyên trong public/assets/AI/ để dựng lại.
*
*  `ffprobe` ĐỌC HỎNG animated WebP (báo "image data not found") — đó là giới
*  hạn demuxer của ffmpeg, KHÔNG phải file hỏng. Header đúng RIFF/WEBP/VP8X/
*  ANIM/ANMF, trình duyệt hiển thị bình thường. Muốn kiểm tra thì mở bằng
*  trình duyệt, đừng dùng ffprobe. */
var AI_IDLE = "/assets/AI/ecolink-ai-normal.webp";
var AI_SCANNING = "/assets/AI/ecolink-ai-scan.webp";
var AI_DONE = "/assets/AI/ecolink-ai-done.webp";
/** Avatar AI đã cắt nền, 320px. Dùng ở chatbox trợ lý chứ KHÔNG dùng
*  `AI_IDLE` cho avatar: bản đó nặng 1,36 MB và có nền trắng vuông. Bản này 23 KB,
*  nền trong suốt nên đặt lên nền nào cũng được. Sinh lại bằng
*  `python tools/cut-avatar.py` khi ảnh gốc đổi. */
var AI_AVATAR = "/assets/AI/ecolink-ai-avatar.webp";
/** độ trễ từng bước khi kết quả hiện ra, đặt trong src/pages/Scanner.tsx (T).
*  Ở đây chỉ giữ thông điệp, vì mốc thời gian gắn liền với cây DOM. */
/** thông điệp dưới ảnh robot khi đang quét. Trạng thái có kết quả thì
*  chỉ hiện tiêu đề, không kèm câu phụ — tiêu đề đã đủ nghĩa. */
var AI_MSG = { scanning: "Đang tìm vật liệu và ước lượng khối lượng..." };
/** Lúc người dùng mới vào, chưa quét gì: phần kết quả mẫu biến thành hướng
*  dẫn dùng, và "hướng dẫn xử lý nhanh" ẩn đi vì chưa có gì để hướng dẫn. */
var HOW_TO = [
	{
		title: "Đưa ảnh vật rác vào",
		desc: "Chụp trực tiếp bằng camera, hoặc tải ảnh có sẵn trong máy."
	},
	{
		title: "AI quét và nhận diện",
		desc: "Hệ thống tìm vật liệu, trả về đơn giá tham khảo kèm độ tin cậy."
	},
	{
		title: "Xem cách xử lý, đặt lịch thu gom",
		desc: "Làm theo hướng dẫn rồi tìm người thu gom gần bạn."
	}
];
//#endregion
//#region src/data/waste.ts
var WASTE_GROUPS = [
	"Tất cả nhóm",
	"Nhựa",
	"Giấy",
	"Kim loại",
	"Thủy tinh",
	"Điện tử",
	"Hữu cơ"
];
var WASTES = [
	{
		id: "pet",
		name: "Chai nhựa PET",
		group: "Nhựa",
		price: 5500,
		recyclable: true,
		rule: "Chai nước, nước giải khát, dầu gội. Nắp nhựa để riêng.",
		prep: "Tráng sơ bằng nước sạch, giãm dẹp, không lẫn nước."
	},
	{
		id: "hdpe",
		name: "Can nhựa HDPE",
		group: "Nhựa",
		price: 4800,
		recyclable: true,
		rule: "Can dầu ăn, can nước, bình nhựa cứng. Bỏ nắp và nhãn nhựa.",
		prep: "Rửa sạch, để ráo nước, giãm dẹp."
	},
	{
		id: "carton",
		name: "Bìa carton",
		group: "Giấy",
		price: 2200,
		recyclable: true,
		rule: "Thùng carton, hộp giấy, bìa bao bì. Không thu gom giấy ướt.",
		prep: "Bỏ lớp dính và băng keo, gấp phẳng."
	},
	{
		id: "office-paper",
		name: "Giấy văn phòng",
		group: "Giấy",
		price: 1900,
		recyclable: true,
		rule: "Giấy A4, sổ, hồ sơ hủy bảo mật qua đối tác có chứng chỉ.",
		prep: "Bỏ ghim, bìa nhựa, dây buộc."
	},
	{
		id: "steel",
		name: "Sắt thép",
		group: "Kim loại",
		price: 3600,
		recyclable: true,
		rule: "Xà gồ, đinh, vỏ hộp. Nhựa bọc phải bóc trước.",
		prep: "Bóc lớp sơn và nhựa, chặt ngắn nếu thanh dài."
	},
	{
		id: "aluminum",
		name: "Nhôm và hợp kim",
		group: "Kim loại",
		price: 14e3,
		recyclable: true,
		rule: "Lon nước, vỏ hộp, xốp nhôm bọc thực phẩm.",
		prep: "Giữ nguyên vỏ lon, không ép dẹp mạnh."
	},
	{
		id: "glass",
		name: "Thủy tinh",
		group: "Thủy tinh",
		price: 900,
		recyclable: true,
		rule: "Chai lọ, hũ thuỷ tinh. Không thu gom gương, kính cường lực.",
		prep: "Rót hết chất lỏng, đậy nắp kín để không vỡ khi vận chuyển."
	},
	{
		id: "battery",
		name: "Pin và ắc quy",
		group: "Điện tử",
		price: 25e3,
		recyclable: true,
		rule: "Pin Li-ion, ắc quy, sạc dự phòng. Điểm thu mua điện tử mới nhận.",
		prep: "Dán băng keo lên cực pin, không để chung với rác ướt."
	},
	{
		id: "ewaste",
		name: "Thiết bị điện tử",
		group: "Điện tử",
		price: 8500,
		recyclable: true,
		rule: "Điện thoại, máy tính, màn hình, linh kiện hỏng.",
		prep: "Xoá dữ liệu trước khi bàn giao, tháo thẻ nhớ nếu có."
	},
	{
		id: "organic",
		name: "Rác hữu cơ",
		group: "Hữu cơ",
		price: 0,
		recyclable: false,
		rule: "Vỏ rau củ, thức ăn thừa. Không đưa vào nhóm thu gom phế liệu.",
		prep: "Bỏ trực tiếp vào thùng rác hữu cơ của địa phương."
	}
];
/** Tiền tạm tính cho một yêu cầu bàn giao (U-07). Dùng chung công thức với
*  biên nhận (U-10, R-06) để số tiền khách thấy lúc đặt và số tiền trả lúc
*  giao luôn bằng nhau — lệch nhau là lý do phát sinh khiếu nại. */
function estimate(items) {
	const lines = items.map((it) => {
		const w = WASTES.find((x) => x.id === it.wasteId);
		const unit = w?.recyclable ? w?.price ?? 0 : 0;
		return {
			...it,
			unit,
			total: unit * it.kg
		};
	});
	return {
		lines,
		gross: lines.reduce((s, l) => s + l.total, 0)
	};
}
/** Phí nền tảng (A-10) trích trên mỗi giao dịch thành công. Đặt ở đây vì cả
*  biên nhận (U-10) và đối soát (A-11) đều cần đúng một con số. */
var FEE_RATE = .08;
/** Giải ngân (SYS-01): PayOS bắn tiền cho User sau khi Recycler đã Pay-in.
*  Phí do nền tảng giữ lại, phần còn lại về tài khoản ngân hàng của User. */
function settle(gross) {
	const fee = Math.round(gross * FEE_RATE);
	return {
		gross,
		fee,
		net: gross - fee
	};
}
var VND = (n) => n.toLocaleString("vi-VN") + " đ";
//#endregion
//#region src/data/ops.ts
/** Dữ liệu vận hành cho Staff và Admin. Tất cả là số mô phỏng nằm cứng trong
*  repo — app chưa có backend. Khi nối API, thay từng bảng ở đây. */
var AI_CASES = [
	{
		id: "AI-4471",
		image: "/assets/scanner/b7b43.png",
		predicted: "Nhựa PET",
		correct: "Nhựa HDPE",
		confidence: 78,
		reporter: "Huỳnh Thị Mai Anh",
		date: "27/09/2026",
		inDataset: true
	},
	{
		id: "AI-4468",
		image: "/assets/map/238fa.png",
		predicted: "Nhựa PET",
		correct: "Nhựa PP",
		confidence: 61,
		reporter: "Phạm Quốc Việt",
		date: "27/09/2026",
		inDataset: false
	},
	{
		id: "AI-4455",
		image: "/assets/map/106f5.png",
		predicted: "Giấy carton",
		correct: "Bìa carton có in",
		confidence: 84,
		reporter: "Đặng Thu Hà",
		date: "26/09/2026",
		inDataset: true
	},
	{
		id: "AI-4440",
		image: "/assets/scanner/28077.png",
		predicted: "Thủy tinh",
		correct: "Nhựa cứng trong suốt",
		confidence: 55,
		reporter: "Võ Thành Long",
		date: "26/09/2026",
		inDataset: false
	},
	{
		id: "AI-4429",
		image: "/assets/partners/28077.png",
		predicted: "Kim loại",
		correct: "Bìa carton",
		confidence: 49,
		reporter: "Bùi Khánh Chi",
		date: "25/09/2026",
		inDataset: false
	}
];
/** Tập dữ liệu kiểm chứng (S-03). `source` cho biết ảnh đến từ đâu vì ảnh từ
*  người dùng báo sai và ảnh do nhân viên tự chụp cần đánh giá khác nhau. */
var DATASET = {
	total: 12480,
	labeled: 11902,
	/** độ chính xác đo trên tập kiểm chứng, % */
	accuracy: 94.6,
	byClass: [
		{
			label: "Nhựa PET",
			count: 3180,
			accuracy: 97.2
		},
		{
			label: "Nhựa HDPE",
			count: 2240,
			accuracy: 95.1
		},
		{
			label: "Bìa carton",
			count: 2610,
			accuracy: 96.4
		},
		{
			label: "Sắt thép",
			count: 1480,
			accuracy: 93.8
		},
		{
			label: "Nhôm",
			count: 1020,
			accuracy: 92.5
		},
		{
			label: "Thủy tinh",
			count: 900,
			accuracy: 89.7
		},
		{
			label: "Pin Li-ion",
			count: 620,
			accuracy: 91.4
		},
		{
			label: "Thiết bị điện tử",
			count: 430,
			accuracy: 88.3
		}
	]
};
var APPLICATIONS = [
	{
		id: "HS-0231",
		name: "Vựa Minh Khai",
		address: "512 Hai Bà Trưng, Quận 5",
		materials: "Kim loại, nhôm, sắt thép",
		docs: [
			"Giấy ĐKDN",
			"Giấy phép thu gom",
			"Ảnh cơ sở"
		],
		date: "27/09/2026",
		status: "pending"
	},
	{
		id: "HS-0228",
		name: "Anh Tuấn - Thu gom tận nhà",
		address: "78 Nguyễn Thái Bình, Quận 1",
		materials: "Nhựa, giấy, thủy tinh",
		docs: ["Giấy ĐKDN", "CCMT người đại diện"],
		date: "26/09/2026",
		status: "pending"
	},
	{
		id: "HS-0219",
		name: "Công ty CP Tái chế Duy Tân",
		address: "KCN Long Bình, TP. Thủ Đức",
		materials: "Nhựa công nghiệp",
		docs: [
			"Giấy ĐKDN",
			"ISO 14001",
			"Hợp đồng thu gom"
		],
		date: "24/09/2026",
		status: "approved"
	},
	{
		id: "HS-0210",
		name: "Tổ hợp thu gom An Phú",
		address: "19 Lê Văn Sỹ, Quận 3",
		materials: "Giấy, bìa carton",
		docs: ["Giấy ĐKDN"],
		date: "22/09/2026",
		status: "rejected",
		note: "Thiếu giấy phép thu gom chất thải rắn."
	}
];
var COMPLAINTS = [
	{
		id: "KN-260928-4F7A",
		title: "Người thu gom đến trễ 3 giờ so với khung giờ đã chốt",
		user: "Nguyễn Đức",
		target: "Cô Ba Thu Gom · BH-2609-0184",
		date: "28/09/2026",
		status: "new"
	},
	{
		id: "KN-260927-1B3C",
		title: "Khối lượng cân thiếu 6kg so với biên nhận",
		user: "Lê Thị Ngọc Hân",
		target: "Vựa Minh Khai · BH-2609-0121",
		date: "27/09/2026",
		status: "working"
	},
	{
		id: "KN-260926-9D2E",
		title: "Nhận diện AI sai, báo lại nhưng chưa thấy kết quả",
		user: "Phạm Quốc Việt",
		target: "AI-4468",
		date: "26/09/2026",
		status: "resolved",
		reply: "Đã gán nhãn đúng và đưa ảnh vào tập kiểm chứng. Cảm ơn bạn đã báo."
	}
];
var ACCOUNTS = [
	{
		id: "U-1042",
		name: "Nguyễn Đức",
		email: "duc.nguyen@email.vn",
		role: "user",
		area: "Quận 3",
		joined: "12/03/2026",
		status: "active",
		deals: 24
	},
	{
		id: "U-1039",
		name: "Lê Thị Ngọc Hân",
		email: "han.le@email.vn",
		role: "user",
		area: "Quận 7",
		joined: "10/03/2026",
		status: "active",
		deals: 31
	},
	{
		id: "U-1031",
		name: "Phạm Quốc Việt",
		email: "viet.pham@email.vn",
		role: "user",
		area: "Thủ Đức",
		joined: "08/03/2026",
		status: "active",
		deals: 12
	},
	{
		id: "B-0207",
		name: "Cô Ba Thu Gom",
		email: "coba@thugom.vn",
		role: "recycler",
		area: "Quận 1",
		joined: "02/04/2026",
		status: "active",
		deals: 268
	},
	{
		id: "B-0211",
		name: "Anh Tuấn",
		email: "tuan@thugom.vn",
		role: "recycler",
		area: "Quận 1",
		joined: "18/04/2026",
		status: "active",
		deals: 143
	},
	{
		id: "B-0202",
		name: "Vựa Minh Khai",
		email: "minhkhai@thugom.vn",
		role: "recycler",
		area: "Quận 5",
		joined: "25/02/2026",
		status: "locked",
		deals: 86
	},
	{
		id: "U-1028",
		name: "Đặng Thu Hà",
		email: "ha.dang@email.vn",
		role: "user",
		area: "Gò Vấp",
		joined: "05/03/2026",
		status: "active",
		deals: 7
	},
	{
		id: "U-1015",
		name: "Võ Thành Long",
		email: "long.vo@email.vn",
		role: "user",
		area: "Quận 8",
		joined: "28/02/2026",
		status: "active",
		deals: 19
	}
];
var PERMS = [
	{
		id: "ai.review",
		label: "Đánh giá ảnh AI"
	},
	{
		id: "ai.dataset",
		label: "Cập nhật tập dữ liệu"
	},
	{
		id: "partner.verify",
		label: "Thẩm định hồ sơ đối tác"
	},
	{
		id: "complaint.handle",
		label: "Xử lý khiếu nại"
	},
	{
		id: "account.manage",
		label: "Quản lý tài khoản"
	},
	{
		id: "blog.write",
		label: "Soạn bài Blog"
	},
	{
		id: "gift.manage",
		label: "Quản lý kho quà"
	}
];
var STAFF = [
	{
		id: "NV-01",
		name: "Lê Thu Hà",
		email: "ha.le@ecolink.vn",
		perms: PERMS.map((p) => p.id),
		status: "active"
	},
	{
		id: "NV-02",
		name: "Trần Đình Khoa",
		email: "khoa.tran@ecolink.vn",
		perms: [
			"ai.review",
			"ai.dataset",
			"complaint.handle"
		],
		status: "active"
	},
	{
		id: "NV-03",
		name: "Phạm Bảo Ngọc",
		email: "ngoc.pham@ecolink.vn",
		perms: ["partner.verify", "blog.write"],
		status: "active"
	}
];
var POSTS = [
	{
		id: "BL-0088",
		title: "Vì sao bìa carton nhà bạn thường bị thu gom giá thấp hơn kỳ vọng",
		excerpt: "Phân loại giấy phụ thuộc độ sạch của lớp phủ và keo dán, không chỉ khối lượng.",
		author: "Phạm Bảo Ngọc",
		date: "27/09/2026",
		status: "pending"
	},
	{
		id: "BL-0087",
		title: "Từ 1kg nhôm phế liệu đến 25kg nhôm có thể tái chế",
		excerpt: "Chuỗi giá trị nhôm tại Việt Nam đang mở rộng ra thế nào.",
		author: "Phạm Bảo Ngọc",
		date: "25/09/2026",
		status: "pending"
	},
	{
		id: "BL-0086",
		title: "Hướng dẫn tái chế pin Li-ion an toàn tại nhà",
		excerpt: "Không bao giờ bỏ pin vào thùng rác thường. Đây là cách xử lý đúng.",
		author: "Lê Thu Hà",
		date: "20/09/2026",
		status: "published"
	},
	{
		id: "BL-0085",
		title: "Thu gom tận nhà: ba câu hỏi nên đặt cho người thu gom",
		excerpt: "Kinh nghiệm thương lượng giá từ 240 giao dịch.",
		author: "Trần Đình Khoa",
		date: "18/09/2026",
		status: "rejected",
		note: "Cần dẫn nguồn số liệu và ghi rõ phạm vi mẫu khảo sát."
	}
];
var ECO_FACTS = [
	{
		id: "EF-01",
		title: "Nhựa PET tái chế thành sợi",
		body: "1kg chai PET có thể tạo ra khoảng 0,7kg sợi tái sinh, đủ dệt 2 chiếc áo phông.",
		cost: 500,
		open: true
	},
	{
		id: "EF-02",
		title: "Phân loại 3R tại Việt Nam",
		body: "Reduce - giảm phát sinh, Reuse - dùng lại, Recycle - tái chế. Luôn theo thứ tự này.",
		cost: 800,
		open: true
	},
	{
		id: "EF-03",
		title: "Pin Li-ion gây hoạ hoả",
		body: "Pin bị dập có thể tự nóng và cháy trong thùng rác. Cần đưa riêng tới điểm thu gom điện tử.",
		cost: 1200,
		open: false
	},
	{
		id: "EF-04",
		title: "Màu nắp thùng rác có ý nghĩa",
		body: "Xanh lá thường cho rác tái chế, vàng cho rác hữu cơ. Quy ước thay đổi theo địa phương, phải xem hướng dẫn tại khu vực của bạn.",
		cost: 1500,
		open: false
	},
	{
		id: "EF-05",
		title: "Bìa carton thu gom giá 2.200đ/kg",
		body: "Giá này áp dụng cho bìa sạch, khô, không còn lớp nhựa. Bìa dính bọc thực phẩm không đạt mức này.",
		cost: 2e3,
		open: false
	},
	{
		id: "EF-06",
		title: "Thuế nhập phẩm và tái chế (EPR)",
		body: "Hạn ngạch EPR buộc nhà sản xuất bao bì chịu trách nhiệm thu gom từ năm 2024, thay đổi cách giá rác được tính.",
		cost: 3e3,
		open: false
	}
];
var GIFTS = [
	{
		id: "g-bag",
		name: "Túi vải tái chế EcoLink",
		cost: 2e3,
		stock: 120,
		kind: "gift",
		active: true
	},
	{
		id: "g-kit",
		name: "Bộ dụng cụ thu gom gia đình",
		cost: 9e3,
		stock: 38,
		kind: "gift",
		active: true
	},
	{
		id: "g-coupon10",
		name: "Giảm 10% phiếu thu gom",
		cost: 6e3,
		stock: null,
		kind: "voucher",
		active: true
	},
	{
		id: "g-tree",
		name: "Một cây xanh trồng từ rác",
		cost: 4500,
		stock: 64,
		kind: "gift",
		active: true
	},
	{
		id: "g-old",
		name: "Hộp bánh mì không nhựa (mẫu cũ)",
		cost: 5e3,
		stock: 0,
		kind: "gift",
		active: false
	}
];
var STATS = {
	users: 48210,
	recyclers: 1284,
	handovers30d: 3640,
	volume30d: 214500,
	gross30d: 1842e6,
	fee30d: 14736e4,
	/** giao dịch đang chờ nhân viên xử lý */
	pending: {
		aiCases: AI_CASES.filter((c) => !c.inDataset).length,
		applications: APPLICATIONS.filter((a) => a.status === "pending").length,
		complaints: COMPLAINTS.filter((c) => c.status !== "resolved").length,
		posts: POSTS.filter((p) => p.status === "pending").length
	},
	trend: [
		{
			month: "T4",
			handovers: 2180,
			volume: 132e3
		},
		{
			month: "T5",
			handovers: 2640,
			volume: 158e3
		},
		{
			month: "T6",
			handovers: 2950,
			volume: 171e3
		},
		{
			month: "T7",
			handovers: 3210,
			volume: 189e3
		},
		{
			month: "T8",
			handovers: 3380,
			volume: 198e3
		},
		{
			month: "T9",
			handovers: 3640,
			volume: 214500
		}
	],
	/** Chất lượng nhận diện AI trong 30 ngày, tách theo nhóm rác.
	*
	*  `correct` là số lượt quét mà AI đoán đúng. `falseReports` là số khiếu nại
	*  của người dùng mà kiểm lại thì AI đúng, người dùng báo nhầm — cần theo dõi
	*  riêng vì nó tốn công nhân viên xác minh mà không thu được gì, và nhiều khi
	*  báo sai vì ảnh chụp mờ chứ không phải vì AI kém.
	*
	*  `correct / scans` là tỷ lệ đúng thực tế của nhóm, dưới mức trung bình nghĩa
	*  là nhóm đó đang đánh đổi uy tín. */
	aiByGroup: [
		{
			group: "Nhựa",
			scans: 48200,
			correct: 45140,
			falseReports: 512
		},
		{
			group: "Giấy",
			scans: 21600,
			correct: 20520,
			falseReports: 188
		},
		{
			group: "Kim loại",
			scans: 14300,
			correct: 13614,
			falseReports: 96
		},
		{
			group: "Thủy tinh",
			scans: 12900,
			correct: 11895,
			falseReports: 341
		},
		{
			group: "Hữu cơ",
			scans: 8700,
			correct: 8178,
			falseReports: 143
		},
		{
			group: "Điện tử",
			scans: 6100,
			correct: 5429,
			falseReports: 407
		}
	]
};
Math.max(...STATS.trend.map((t) => t.handovers));
/** Số lượt quét lớn nhất — mẫu số chung để hai dãi thanh dùng CÙNG một thang
*  đo. Nếu mỗi dải tự chuẩn hoá theo giá trị lớn nhất của nó thì mắt so sánh
*  nhầm: cột "khiếu nại sai" dài bằng cột lớn nhất của nó chứ không phải bằng
*  tỷ lệ thật. */
var AI_SCAN_PEAK = Math.max(...STATS.aiByGroup.map((g) => g.scans));
var GAMIFICATION = {
	/** điểm cho mỗi kg bàn giao đúng loại */
	pointsPerKg: 10,
	/** điểm thưởng khi nhân viên gán nhãn đúng */
	labelBonus: 5,
	tiers: [
		{
			name: "Mầm",
			min: 0,
			factCost: 0
		},
		{
			name: "Cây",
			min: 5e3,
			factCost: 500
		},
		{
			name: "Rừng",
			min: 15e3,
			factCost: 1200
		},
		{
			name: "Đại dương",
			min: 3e4,
			factCost: 2e3
		}
	]
};
var CYCLES = [
	{
		id: "week",
		label: "Tuần",
		from: "Thứ 2",
		to: "Chủ nhật",
		active: true
	},
	{
		id: "month",
		label: "Tháng",
		from: "Ngày 1",
		to: "Ngày cuối tháng",
		active: true
	},
	{
		id: "quarter",
		label: "Quý",
		from: "Ngày 1 quý",
		to: "Ngày cuối quý",
		active: false
	}
];
var FEE = {
	rate: FEE_RATE,
	/** phần phí cố định trên mỗi lượt thu gom, đồng */
	fixed: 2e3,
	minNet: 5e3,
	effectiveFrom: "01/09/2026"
};
var fmtInt = (n) => n.toLocaleString("vi-VN");
var fmtVnd = (n) => n.toLocaleString("vi-VN") + " đ";
//#endregion
//#region src/data/cashflow.ts
var FLOWS = [
	{
		id: "CF-2609-0184",
		date: "28/09/2026",
		handoverId: "BH-2609-0184",
		kind: "payout",
		amount: 17600,
		party: "STK 0070 1234 5678 · Nguyễn Đức",
		note: "Giải ngân tự động qua PayOS sau khi Recycler xác nhận Pay-in."
	},
	{
		id: "CF-2609-0184-a",
		date: "28/09/2026",
		handoverId: "BH-2609-0184",
		kind: "payin",
		amount: 19143,
		party: "Cô Ba Thu Gom",
		note: "Recycler chuyển khoản VietQR để bàn giao."
	},
	{
		id: "CF-2609-0184-f",
		date: "28/09/2026",
		handoverId: "BH-2609-0184",
		kind: "fee",
		amount: 1543,
		party: "Phí nền tảng 8%",
		note: "Trích trên giao dịch thành công."
	},
	{
		id: "CF-2609-0121",
		date: "21/09/2026",
		handoverId: "BH-2609-0121",
		kind: "payout",
		amount: 87770,
		party: "STK 0070 1234 5678 · Nguyễn Đức",
		note: "Giải ngân tự động qua PayOS."
	},
	{
		id: "CF-2609-0121-a",
		date: "21/09/2026",
		handoverId: "BH-2609-0121",
		kind: "payin",
		amount: 95402,
		party: "Vựa Minh Khai",
		note: "Recycler chuyển khoản VietQR để bàn giao."
	},
	{
		id: "CF-2609-0121-f",
		date: "21/09/2026",
		handoverId: "BH-2609-0121",
		kind: "fee",
		amount: 7632,
		party: "Phí nền tảng 8%",
		note: "Trích trên giao dịch thành công."
	},
	{
		id: "CF-2608-0409",
		date: "12/08/2026",
		handoverId: "BH-2608-0409",
		kind: "payout",
		amount: 14904,
		party: "STK 0070 1234 5678 · Nguyễn Đức",
		note: "Giải ngân tự động qua PayOS."
	}
];
/** Ngân hàng liên kết trong form tài khoản nhận tiền (U-13). */
var BANKS = [
	"Vietcombank",
	"Techcombank",
	"BIDV",
	"MB Bank",
	"Agribank",
	"VPBank"
];
var KIND_LABEL = {
	payin: "Thu vào từ đối tác",
	fee: "Phí nền tảng",
	payout: "Bãn ra về tài khoản"
};
/** Kiểm tra số tài khoản ngân hàng Việt Nam: 6-20 chữ số. Chỉ kiểm tra độ
*  dài vì định dạng cụ thể khác nhau theo ngân hàng — chặt hơn thì chặn nhầm
*  tài khoản hợp lệ. */
function validAccount(no) {
	return /^\d{6,20}$/.test(no.replace(/[\s.]/g, ""));
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
					children: /* @__PURE__ */ jsx(Outlet, {})
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
	const navigate = useNavigate();
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
						navigate("/login");
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
/** Chốt chặn route theo vai trò. Chưa đăng nhập -> về trang chủ /, đã đăng nhập sai
*  vai trò -> về trang chủ của vai trò đó.
*
*  Đây chỉ là chốt chặn phía client để không ai thấy màn hình của vai trò
*  khác. Bảo mật thật phải nằm ở backend: mỗi API tự kiểm tra token, nếu không
*  thì A-04 "phân quyền" chỉ là trang trí. */
function RequireRole({ roles, children }) {
	const session = useSession();
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
//#region src/pages/Home.tsx
/** Ba việc app thật sự làm, mỗi việc trỏ tới một route có thật */
var FEATURES = [
	{
		to: "/scanner",
		kicker: "01",
		title: "Nhận diện bằng AI",
		body: "Chụp ảnh rác, nhận vật liệu và đơn giá tham khảo trong vài giây, kèm hướng dẫn cách xử lý đúng."
	},
	{
		to: "/map",
		kicker: "02",
		title: "Kết nối người thu gom",
		body: "Xem điểm thu gom quanh bạn và đặt lịch người thu gom đến tận nhà, theo dõi lộ trình."
	},
	{
		to: "/partners",
		kicker: "03",
		title: "Nối chuỗi giá trị",
		body: "Kết nối trực tiếp với nhà máy tái chế đạt chuẩn, có chứng chỉ ISO và FSC công khai."
	}
];
var STEPS$1 = [
	"Chụp ảnh vật rác cần phân loại",
	"Nhận vật liệu, định giá và cách xử lý",
	"Đặt lịch thu gom tại nhà trong vài phút"
];
function Home() {
	const video = useRef(null);
	const [muted, setMuted] = useState(true);
	/** Bật tiếng. `play()` phải gọi lại trong thao tác của người dùng: video đang
	*  `autoplay muted`, nếu chỉ gỡ `muted` thì trình duyệt coi là phát tự động
	*  có tiếng và từ chối. Chỉ sửa thuộc tính là không đủ. */
	const toggleSound = () => {
		const v = video.current;
		if (!v) return;
		v.muted = !v.muted;
		setMuted(v.muted);
		if (!v.muted) v.play();
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col",
		children: [
			/* @__PURE__ */ jsx("section", {
				className: "pt-10 pb-10 md:pt-14 md:pb-12",
				children: /* @__PURE__ */ jsxs("div", {
					className: "grid items-center gap-10 lg:grid-cols-[0.71fr_1fr] lg:gap-12",
					children: [/* @__PURE__ */ jsxs("div", { children: [
						/* @__PURE__ */ jsx("p", {
							className: "eyebrow",
							children: "HỆ SINH THÁI TUẦN HOÀN"
						}),
						/* @__PURE__ */ jsx("h1", {
							className: "display mt-3 text-[34px] leading-[1.1] md:text-[42px] md:leading-[46px] lg:text-[46px] lg:leading-[50px]",
							children: "Phân loại đúng – Thu gom dễ – Tái chế hiệu quả"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-4 text-base leading-[26px] text-body",
							children: "Chụp ảnh để nhận diện rác, nhận hướng dẫn xử lý và kết nối với điểm thu gom tái chế gần bạn."
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-7 flex flex-wrap gap-3",
							children: [/* @__PURE__ */ jsx(Link, {
								to: "/scanner",
								className: "btn-primary h-12 px-6",
								children: "Thử nhận diện ngay"
							}), /* @__PURE__ */ jsx(Link, {
								to: "/map",
								className: "btn-outline h-12 px-6",
								children: "Tìm người thu gom"
							})]
						})
					] }), /* @__PURE__ */ jsxs("div", {
						className: "relative overflow-clip rounded-2xl border border-line bg-surface-2 shadow-[0_1px_2px_rgba(15,31,21,0.05)]",
						children: [/* @__PURE__ */ jsxs("video", {
							ref: video,
							className: "aspect-video w-full object-cover",
							autoPlay: true,
							muted: true,
							loop: true,
							playsInline: true,
							preload: "auto",
							poster: "/assets/video/poster.jpg",
							"aria-label": "Video giới thiệu cách dùng EcoLink",
							children: [/* @__PURE__ */ jsx("source", {
								src: "/assets/video/intro.mp4",
								type: "video/mp4"
							}), "Trình duyệt của bạn không hỗ trợ phát video."]
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: toggleSound,
							"aria-pressed": !muted,
							"aria-label": muted ? "Bật tiếng video" : "Tắt tiếng video",
							title: muted ? "Bật tiếng" : "Tắt tiếng",
							className: "absolute right-3 bottom-3 grid size-9 place-items-center rounded-full text-ink/75 ring-1 ring-ink/15 transition-colors hover:bg-ink/6 hover:text-ink focus-visible:ring-2 focus-visible:ring-brand",
							children: muted ? /* @__PURE__ */ jsx(MuteIcon, {}) : /* @__PURE__ */ jsx(SoundIcon, {})
						})]
					})]
				})
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "rounded-2xl border border-line bg-surface-2/70 px-5 py-8 md:px-8 md:py-10",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-center text-xl leading-7 font-bold tracking-tight text-ink",
					children: "EcoLink hoạt động thế nào"
				}), /* @__PURE__ */ jsx("ol", {
					className: "mt-8 grid gap-y-6 sm:grid-cols-3 sm:gap-x-8",
					children: STEPS$1.map((step, i) => /* @__PURE__ */ jsxs("li", {
						className: "flex items-start gap-4",
						children: [/* @__PURE__ */ jsx("span", {
							className: "grid size-11 shrink-0 place-items-center rounded-full bg-brand text-base font-bold text-white",
							children: i + 1
						}), /* @__PURE__ */ jsx("p", {
							className: "pt-1.5 text-base leading-6 font-semibold text-ink",
							children: step
						})]
					}, step))
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "py-12 md:py-14",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-2xl leading-8 font-bold tracking-tight text-ink",
					children: "Nền tảng gồm những gì"
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-6 grid gap-6 md:grid-cols-3",
					children: FEATURES.map((f) => /* @__PURE__ */ jsxs(Link, {
						to: f.to,
						className: "card group flex flex-col p-6 transition-colors hover:border-brand/40 hover:bg-surface-2/60",
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "text-xs font-semibold tracking-[0.12em] text-brand uppercase",
								children: f.kicker
							}),
							/* @__PURE__ */ jsx("h3", {
								className: "mt-3 text-lg leading-7 font-bold text-ink",
								children: f.title
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-2 text-sm leading-6 text-body",
								children: f.body
							}),
							/* @__PURE__ */ jsxs("span", {
								className: "mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand",
								children: ["Tìm hiểu", /* @__PURE__ */ jsx("span", {
									"aria-hidden": "true",
									className: "transition-transform duration-200 group-hover:translate-x-0.5",
									children: "→"
								})]
							})
						]
					}, f.to))
				})]
			})
		]
	});
}
/** Hai icon cùng bộ kích thước: chỉ khác ở sóng âm, đổi trạng thái mà không
*  nhảy layout. */
var stroke$4 = {
	stroke: "currentColor",
	strokeWidth: 1.8,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function SoundIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: "size-4",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M11 5 6.5 9H3v6h3.5L11 19V5Z",
			...stroke$4
		}), /* @__PURE__ */ jsx("path", {
			d: "M15.5 9.2a4 4 0 0 1 0 5.6M18.5 6.5a8 8 0 0 1 0 11",
			...stroke$4
		})]
	});
}
function MuteIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: "size-4",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M11 5 6.5 9H3v6h3.5L11 19V5Z",
			...stroke$4
		}), /* @__PURE__ */ jsx("path", {
			d: "m15.5 9.5 5 5m0-5-5 5",
			...stroke$4
		})]
	});
}
//#endregion
//#region src/data/insights.ts
var FEATURED = {
	kicker: "TIÊU ĐIỂM",
	readTime: "5 phút đọc",
	publication: "Kinh tế Tuần hoàn",
	title: "Khủng hoảng rác thải nhựa đại dương & Bước chuyển của chuỗi giá trị",
	excerpt: "Các chuỗi giá trị Đông Nam Á đang tái định hình hạ tầng thu gom với hạn ngạch EPR khắt khe, kết nối trực tiếp người dân vào mạng lưới tái chế quy chuẩn.",
	image: "/assets/insights/36f2d.png"
};
/** tone = ý nghĩa, không phải thứ tự: `warn` là con số cần cải thiện,
*  `good` là thành tích. Không dùng xanh lá cho tin xấu. */
var METRICS = [
	{
		label: "QUY MÔ PHÁT THẢI TOÀN CẦU",
		value: "350M+",
		tone: "warn",
		note: "tấn rác nhựa phát sinh hàng năm cần được quản trị"
	},
	{
		label: "TỶ LỆ HOÀN LƯU GIÁ TRỊ",
		value: "9%",
		tone: "warn",
		note: "thực sự được phân loại và tái sinh thành nguyên liệu mới"
	},
	{
		label: "ĐÃ SỐ HÓA QUA ECOLINK",
		value: "12.4k",
		tone: "good",
		note: "tấn phế liệu chuẩn đã khớp nối tuần hoàn thành công"
	}
];
var ARTICLES = [
	{
		source: "UNEP",
		readTime: "4 phút đọc",
		title: "Mỏ vàng từ bo mạch cũ: Đòn bẩy kinh tế cho ngành tái chế thiết bị viễn thông",
		excerpt: "Phục hồi kim loại quý từ 1 triệu điện thoại tương đương khai thác 35 tấn quặng mà không gây tổn hại địa chất sinh thái.",
		image: "/assets/insights/c4ba2.png"
	},
	{
		source: "MONRE",
		readTime: "6 phút đọc",
		title: "Khung pháp lý Trách nhiệm Mở rộng của Nhà sản xuất: Hạn ngạch bắt đầu hiệu lực",
		excerpt: "Doanh nghiệp F&B và bao bì tiêu dùng bắt buộc đạt tỷ lệ tái chế thực tế theo quy chuẩn mới nhằm hướng tới Net-Zero.",
		image: "/assets/insights/fc414.png"
	},
	{
		source: "World Bank Report",
		readTime: "5 phút đọc",
		title: "Tín dụng xanh: Nền tảng cho chuỗi thu gom tuần hoàn tại Đồng bằng sông Cửu Long",
		excerpt: "Chuyển đổi phụ phẩm nông nghiệp thành nguồn năng lượng sinh khối biomass xuất khẩu sang thị trường Đông Á.",
		image: "/assets/insights/01ee5.png"
	}
];
//#endregion
//#region src/pages/Blog.tsx
/** Chỉ con số thành tích mới mang màu. Trước đây 350M+ và 9% tô cam cảnh
*  báo ở cỡ 48px, biến chúng thành hai mảng nổi bật nhất trang. */
var VALUE_TONE = {
	good: "text-brand",
	warn: "text-ink"
};
function Blog() {
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col",
		children: [
			/* @__PURE__ */ jsxs("section", {
				className: "py-10 text-center md:py-16",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "eyebrow",
						children: "Tin tức & phân tích"
					}),
					/* @__PURE__ */ jsx("h1", {
						className: "display mt-3 text-4xl leading-none md:text-[48px] md:leading-[48px]",
						children: "Bài viết về rác thải & kinh tế tuần hoàn"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-4 text-base leading-[26px] text-body",
						children: "Chuỗi giá trị tái chế, hạn ngạch EPR và cách hạ tầng thu gom đang thay đổi tại Việt Nam."
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "grid items-center gap-10 pb-20 md:grid-cols-12",
				children: [/* @__PURE__ */ jsx("div", {
					className: "overflow-clip rounded-2xl bg-surface-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] md:col-span-7",
					children: /* @__PURE__ */ jsx("img", {
						src: FEATURED.image,
						alt: FEATURED.title,
						className: "h-full w-full object-cover",
						loading: "lazy"
					})
				}), /* @__PURE__ */ jsxs("div", {
					className: "md:col-span-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "mb-4 flex flex-wrap items-center gap-3 text-xs",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "font-semibold tracking-[0.6px] text-brand uppercase",
									children: FEATURED.kicker
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "text-body",
									children: ["• ", FEATURED.readTime]
								}),
								/* @__PURE__ */ jsx("span", {
									className: "text-body",
									children: FEATURED.publication
								})
							]
						}),
						/* @__PURE__ */ jsx("h2", {
							className: "text-3xl leading-9 font-bold tracking-tight text-ink",
							children: FEATURED.title
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-6 text-base leading-6 text-body",
							children: FEATURED.excerpt
						}),
						/* @__PURE__ */ jsxs("a", {
							href: "#",
							className: "link-underline mt-2",
							children: ["Đọc bài phân tích", /* @__PURE__ */ jsx(ArrowRight, {})]
						})
					]
				})]
			}),
			/* @__PURE__ */ jsx("section", {
				className: "flex flex-col gap-12 border-y border-line py-12 sm:flex-row",
				children: METRICS.map((m, i) => /* @__PURE__ */ jsxs("div", {
					className: i === 0 ? "flex-1" : `flex-1 border-line pl-0 sm:border-l sm:pl-12`,
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-xs font-medium tracking-[1.2px] text-body uppercase",
							children: m.label
						}),
						/* @__PURE__ */ jsx("p", {
							className: `text-[48px] leading-[48px] font-bold tracking-tight ${VALUE_TONE[m.tone]}`,
							children: m.value
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-xs leading-[19.5px] text-body",
							children: m.note
						})
					]
				}, m.label))
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "max-w-[896px] pt-20",
				children: [/* @__PURE__ */ jsxs("header", {
					className: "flex items-baseline justify-between border-b border-line pb-4",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-2xl leading-8 font-bold tracking-tight text-ink",
						children: "Bài viết chọn lọc"
					}), /* @__PURE__ */ jsx("span", {
						className: "text-xs text-body",
						children: "Cập nhật hằng tuần"
					})]
				}), /* @__PURE__ */ jsx("ul", { children: ARTICLES.map((a, i) => /* @__PURE__ */ jsxs("li", {
					className: `flex gap-8 pt-8 pb-8 ${i > 0 ? "border-t border-line" : ""}`,
					children: [/* @__PURE__ */ jsx("div", {
						className: "h-32 w-48 shrink-0 overflow-clip rounded-xl bg-surface-2",
						children: /* @__PURE__ */ jsx("img", {
							src: a.image,
							alt: a.source,
							className: "size-full object-cover",
							loading: "lazy"
						})
					}), /* @__PURE__ */ jsxs("div", {
						className: "flex flex-1 flex-col",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "mb-2 flex flex-wrap items-center gap-3 text-xs",
								children: [/* @__PURE__ */ jsx("span", {
									className: "font-semibold text-brand",
									children: a.source
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-body",
									children: ["• ", a.readTime]
								})]
							}),
							/* @__PURE__ */ jsx("h3", {
								className: "text-xl leading-7 font-bold tracking-tight text-ink",
								children: a.title
							}),
							a.excerpt && /* @__PURE__ */ jsx("p", {
								className: "mt-2 text-sm leading-[22.75px] text-body",
								children: a.excerpt
							})
						]
					})]
				}, a.title)) })]
			})
		]
	});
}
function ArrowRight() {
	return /* @__PURE__ */ jsx("svg", {
		width: "12",
		height: "12",
		viewBox: "0 0 12 12",
		fill: "none",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("path", {
			d: "M2 6h8m0 0L6.5 2.5M10 6l-3.5 3.5",
			stroke: "currentColor",
			strokeWidth: "1.4",
			strokeLinecap: "round",
			strokeLinejoin: "round"
		})
	});
}
//#endregion
//#region src/data/checkin.ts
/** Điểm danh hằng ngày. Ngày liên tiếp thì chuỗi tiếp, bỏ một ngày thì
*  chuỗi đứt. Chuỗi 7 ngày đủ thì quay lại ngày 1 và nhận thưởng lớn hơn.
*
*  ponytail: lưu localStorage vì điểm danh mà không nhớ trạng thái thì vô
*  nghĩa — mở lại trang là mất. Khi có tài khoản thật thì đọc/ghi server,
*  hàm này giữ nguyên vì nó thuần, không đụng DOM. */
var CHECKIN_REWARDS = [
	20,
	30,
	50,
	70,
	100,
	150,
	500
];
var CHECKIN_DAYS = CHECKIN_REWARDS.length;
/** yyyy-mm-dd theo giờ địa phương (toISOString đổi sang UTC nên lệch ngày). */
function dayKey(d = /* @__PURE__ */ new Date()) {
	const p = (n) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function readCheckIn(key) {
	try {
		const raw = localStorage.getItem(key);
		if (raw) {
			const v = JSON.parse(raw);
			if (typeof v?.day === "number" && typeof v?.last === "string") return v;
		}
	} catch {}
	return {
		day: 0,
		last: ""
	};
}
function writeCheckIn(key, v) {
	try {
		localStorage.setItem(key, JSON.stringify(v));
	} catch {}
}
/** ngày hôm nay đã điểm danh chưa */
function doneToday(v, today = dayKey()) {
	return v.last === today;
}
/** điểm sẽ nhận được nếu điểm danh hôm nay, 0 nếu hôm nay đã điểm danh rồi.
*  Điểm chuỗi 7 ngày = 920; ngày thứ 7 trả 500 chiếm hơn nửa, đủ để tạo
*  lý do phải quay lại ngày 7 mà không bị xem là bắt lợi nhiều. */
function nextReward(v, today = dayKey()) {
	if (doneToday(v, today)) return 0;
	return CHECKIN_REWARDS[v.day % CHECKIN_DAYS];
}
/** ngày nào sẽ điểm danh tiếp theo — chuỗi còn giữ hay đứt.
*  day === 0 KHÔNG đủ để kết luận chuỗi còn sống: sau khi đủ 7 ngày, day quay
*  về 0 nhưng chuỗi vẫn phải còn nếu hôm qua có điểm danh. Chỉ "chưa từng
*  điểm danh" (last rỗng) mới coi là bắt đầu. */
function streakAlive(v, today = dayKey()) {
	if (doneToday(v, today)) return true;
	if (!v.last) return true;
	const t = /* @__PURE__ */ new Date(`${today}T00:00:00`);
	t.setDate(t.getDate() - 1);
	return v.last === dayKey(t);
}
/** bấm điểm danh hôm nay. Trả về trạng thái mới + điểm được cộng. */
function checkIn(v, today = dayKey()) {
	if (doneToday(v, today)) return {
		next: v,
		gained: 0
	};
	const carried = streakAlive(v, today) ? v.day : 0;
	return {
		next: {
			day: (carried + 1) % CHECKIN_DAYS,
			last: today
		},
		gained: CHECKIN_REWARDS[carried]
	};
}
//#endregion
//#region src/data/rewards.ts
/** Hai loại điểm, tách bạch vì hai việc khác nhau:
*
*  - RANK_POINTS  điểm XẾP HẠNG, tích luỹ trọn đời, KHÔNG bao giờ bị trừ.
*    Chỉ nó quyết định bạn ở hạng nào. Đổi quà không làm tụt hạng.
*  - SPEND_POINTS điểm TIÊU DÙNG, trừ dần khi đổi quà. Đây mới là tiền
*    thật sự trong túi để đổi.
*
*  Quan hệ bất biến: SPEND_POINTS <= RANK_POINTS, phần chênh là đã đổi rồi.
*
*  ponytail: hai số này là mô phỏng — app chưa có backend, chưa có nơi
*  cộng/trừ điểm. Backend có thật thì đọc từ đây. */
var RANK_POINTS = 23400;
var SPEND_POINTS = 12400;
/** ngưỡng lên hạng, tính trên RANK_POINTS */
var TIERS = [
	{
		min: 0,
		name: "Mầm"
	},
	{
		min: 5e3,
		name: "Cây"
	},
	{
		min: 15e3,
		name: "Rừng"
	},
	{
		min: 3e4,
		name: "Đại dương"
	}
];
var REWARDS = [
	{
		id: "bag",
		name: "Túi vải tái chế EcoLink",
		desc: "Túi canvas in logo, may tại xưởng tái chế đối tác.",
		cost: 2e3,
		stock: 120,
		kind: "gift",
		img: "/assets/rewards/bag.jpg"
	},
	{
		id: "glasses",
		name: "Bộ ly thuỷ tinh tái chế",
		desc: "Ly thuỷ tinh tái sinh từ chai thu mua, đạt chuẩn tiếp xúc thực phẩm.",
		cost: 3500,
		stock: 150,
		kind: "gift",
		img: "/assets/rewards/glasses.jpg"
	},
	{
		id: "seedling",
		name: "Một cây xanh trồng từ rác",
		desc: "Cây bản địa, kèm hướng dẫn chăm từ hạt rác tái chế.",
		cost: 4500,
		stock: 64,
		kind: "tree",
		img: "/assets/rewards/seedling.jpg"
	},
	{
		id: "coupon10",
		name: "Giảm 10% phiếu thu gom",
		desc: "Áp dụng tại các điểm thu gom đối tác trên toàn quốc.",
		cost: 6e3,
		stock: null,
		kind: "discount",
		img: "/assets/rewards/coupon10.jpg"
	},
	{
		id: "kit",
		name: "Bộ dụng cụ thu gom gia đình",
		desc: "Kéo gom 3 thùng phân loại và bao đựng rác.",
		cost: 9e3,
		stock: 38,
		kind: "gift",
		img: "/assets/rewards/kit.jpg"
	},
	{
		id: "compactor",
		name: "Máy ép rác gia đình 20 lít",
		desc: "Ép chai và hộp cứng để giảm khoảng 3 lần thể tích, đặt được trong bếp.",
		cost: 18e3,
		stock: 24,
		kind: "gift",
		img: "/assets/rewards/compactor.jpg"
	}
];
var fmt = (n) => n.toLocaleString("vi-VN");
var curTier = () => TIERS.filter((t) => 23400 >= t.min).at(-1) ?? TIERS[0];
var nextTier = () => TIERS.find((t) => RANK_POINTS < t.min);
/** tiến độ trong bậc hiện tại, 0–100. Còn hạng cuối thì luôn 100. */
/** tiến độ trong bậc hiện tại, 0–100. Còn hạng cuối thì luôn 100.
*  Tính trên RANK_POINTS: đổi quà không được làm tụt hạng. */
function tierProgress() {
	const cur = curTier();
	const next = nextTier();
	if (!next) return {
		cur,
		next: null,
		pct: 100,
		need: 0
	};
	const span = next.min - cur.min;
	const done = RANK_POINTS - cur.min;
	return {
		cur,
		next,
		pct: Math.round(done / span * 100),
		need: next.min - RANK_POINTS
	};
}
/** điểm đã đổi rồi = tổng tích luỹ trừ đi còn lại. Giải thích vì sao hai
*  con số lệch nhau, không thì người dùng tưởng bị tính sai. */
var REDEEMED = 11e3;
var GRAND_PRIZES = [
	{
		id: "grand-scooter",
		name: "Xe điện thay cho cả gia đình",
		desc: "Bàn giao tại nhà, kèm 1 năm bảo hành và 500 lượt sạc.",
		cost: 15e4,
		img: "/assets/rewards/grand-scooter.jpg"
	},
	{
		id: "grand-trip",
		name: "Tuần trải nghiệm ở nhà máy tái chế",
		desc: "5 ngày đi thật các dây chuyền phân loại cùng đội ngũ kỹ thuật.",
		cost: 6e4,
		img: "/assets/rewards/grand-trip.jpg",
		details: [
			"Ngày 1: nhận sơ đồ dây chuyền, làm quen đội kỹ thuật và quy trình an toàn.",
			"Ngày 2: đứng cạnh băng tải, xem rác được phân loại thành nhóm nào và vì sao.",
			"Ngày 3: theo dây chuyền băm và nén thành bánh phế liệu để vận chuyển.",
			"Ngày 4: tham quan khu chế biến, tận mắt xem phế liệu thành sản phẩm mới.",
			"Ngày 5: chốt lại bằng buổi thử phân loại tại nhà, tự chấm điểm cùng đội ngũ."
		]
	},
	{
		id: "grand-cookware",
		name: "Bộ nồi chảo inox 304 cho cả nhà",
		desc: "Nồi 3 lớp và chảo chiên, làm tại nhà máy đối tác, bảo hành 2 năm.",
		cost: 45e3,
		img: "/assets/rewards/grand-cookware.jpg",
		details: [
			"2 nồi 3 lớp, 2 chảo chiên, 1 nồi cà phê và 6 nắp kín.",
			"Inox 304 nguyên liệu, đáy triện từ nên không dính và không cháy khét.",
			"Bộ đồ dùng được trên cả bếp từ và bếp gas, đưa vào máy rửa bát được."
		]
	}
];
var LEADERBOARD = [
	{
		name: "Trần Minh Khoa",
		area: "Bình Thạnh",
		points: 48200
	},
	{
		name: "Lê Thị Ngọc Hân",
		area: "Quận 7",
		points: 39800
	},
	{
		name: "Phạm Quốc Việt",
		area: "Thủ Đức",
		points: 31500
	},
	{
		name: "Huỳnh Thị Mai Anh",
		area: "Tân Bình",
		points: 27900
	},
	{
		name: "Nguyễn Đức",
		area: "Quận 3",
		points: RANK_POINTS,
		you: true
	},
	{
		name: "Đặng Thu Hà",
		area: "Gò Vấp",
		points: 19300
	},
	{
		name: "Võ Thành Long",
		area: "Quận 8",
		points: 14600
	},
	{
		name: "Bùi Khánh Chi",
		area: "Phú Nhuận",
		points: 8100
	}
];
/** vòng lặp của EcoLink: giao rác đúng phân loại -> được xác nhận -> cộng điểm */
var EARN = [
	{
		title: "Giao rác đúng phân loại",
		desc: "Nhận diện ra đúng vật liệu"
	},
	{
		title: "Người thu gom xác nhận",
		desc: "Đối chiếu khối lượng tại nhà bạn"
	},
	{
		title: "Giao đủ khối lượng",
		desc: "Cộng thêm theo từng kg đã tái chế"
	}
];
//#endregion
//#region src/components/CheckIn.tsx
var KEY = "ecolink.checkin";
/** Đơn vị điểm của phần điểm danh: xu EcoLink.
*
*  Dùng bản `.webp` chứ không dùng `.png`: file gốc 1254px nặng 897KB, mà icon
*  này hiển thị 12–16px — thừa ~80 lần. Bản webp 128px nặng 2.4KB, giảm 99,7%
*  và vẫn giữ alpha (đã kiểm bằng cách ép nền xanh sau ảnh).
*    ffmpeg -i ecolink-coin.png -vf "scale=128:128:flags=lanczos" \
*           -c:v libwebp -lossless 0 -quality 82 -an ecolink-coin.webp
*  File gốc PNG giữ nguyên trong `public/assets/AI/` để dựng lại, y hệt bộ
*  ảnh robot AI. */
var COIN$1 = "/assets/AI/ecolink-coin.webp";
function Coin({ className }) {
	return /* @__PURE__ */ jsx("img", {
		src: COIN$1,
		alt: "",
		"aria-hidden": "true",
		loading: "lazy",
		decoding: "async",
		width: 128,
		height: 128,
		className: `shrink-0 object-contain ${className}`
	});
}
/** Điểm danh hằng ngày. Chuỗi 7 ngày, ngày thứ 7 trả gấp rưỡi cả chuỗi để
*  có lý do phải quay lại. Bỏ một ngày là chuỗi đứt, về lại mốc 20.
*
*  Điểm cộng vào số dư của cha: bấm là thấy con số tăng ngay cạnh nút, nếu
*  không thì nút bấm không có phản hồi gì. */
function CheckIn({ balance, onEarn }) {
	const [v, setV] = useState(() => readCheckIn(KEY));
	const [flash, setFlash] = useState(0);
	const today = dayKey();
	const done = doneToday(v, today);
	const next = nextReward(v, today);
	const press = () => {
		const r = checkIn(v, today);
		if (r.gained === 0) return;
		setV(r.next);
		writeCheckIn(KEY, r.next);
		onEarn(r.gained);
		setFlash(r.gained);
	};
	return /* @__PURE__ */ jsxs(Fragment, { children: [
		/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base leading-6 font-bold tracking-tight text-ink",
				children: "Điểm danh hằng ngày"
			}), /* @__PURE__ */ jsx("p", {
				className: "text-[13px] text-muted",
				children: done ? "Đã điểm danh hôm nay" : `Còn ${fmt(next)} điểm hôm nay`
			})]
		}),
		/* @__PURE__ */ jsx("ol", {
			className: "mt-4 grid grid-cols-7 gap-1.5",
			children: CHECKIN_REWARDS.map((r, i) => {
				const passed = i < v.day;
				const isNext = !done && i === v.day;
				const isLast = i === CHECKIN_DAYS - 1;
				return /* @__PURE__ */ jsxs("li", {
					className: "flex flex-col items-center gap-1",
					children: [/* @__PURE__ */ jsx("span", {
						className: `flex aspect-square w-full flex-col items-center justify-center gap-0.5 rounded-lg font-bold tabular-nums ${isLast ? "bg-brand text-white" : passed ? "bg-brand/12 text-brand" : isNext ? "bg-surface-2 text-ink" : "bg-surface-2/60 text-muted"}`,
						children: passed ? "✓" : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(Coin, { className: "size-3.5 sm:size-7" }), /* @__PURE__ */ jsxs("span", {
							className: "text-[10px] sm:text-base",
							children: ["+", fmt(r)]
						})] })
					}), /* @__PURE__ */ jsxs("span", {
						className: "text-[9px] whitespace-nowrap text-muted sm:text-[10px]",
						children: ["Ngày ", i + 1]
					})]
				}, r);
			})
		}),
		/* @__PURE__ */ jsxs("div", {
			className: "mt-5 flex flex-wrap items-center gap-x-4 gap-y-3",
			children: [/* @__PURE__ */ jsxs("button", {
				type: "button",
				onClick: press,
				disabled: done,
				className: "btn btn-primary h-11 px-5",
				children: [done ? "Đã điểm danh" : `Nhận ${fmt(next)}`, !done && /* @__PURE__ */ jsx(Coin, { className: "size-4" })]
			}), /* @__PURE__ */ jsx("p", {
				className: "text-[13px] leading-5 text-muted",
				role: "status",
				children: flash > 0 ? /* @__PURE__ */ jsxs("span", {
					className: "inline-flex flex-wrap items-center gap-1 font-semibold text-brand",
					children: [/* @__PURE__ */ jsxs("span", { children: [
						"+",
						fmt(flash),
						" điểm · số dư ",
						fmt(balance)
					] }), /* @__PURE__ */ jsx(Coin, { className: "size-4" })]
				}) : done ? `Chuỗi ${v.day}/7 ngày${streakAlive(v, today) ? "" : " · chuỗi đã đứt"}` : "Bỏ một ngày là chuỗi tính lại từ đầu."
			})]
		})
	] });
}
//#endregion
//#region src/pages/Rewards.tsx
/** Icon điểm. Dùng chung với CheckIn để "điểm" luôn là một biểu tượng duy
*  nhất, không phải chỗ này chữ "điểm" chỗ kia số trần trụi. */
var COIN = "/assets/AI/ecolink-coin.webp";
var stroke$3 = {
	stroke: "currentColor",
	strokeWidth: 1.6,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function RewardIcon({ kind }) {
	const box = "size-[18px]";
	if (kind === "discount") return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: box,
		children: [/* @__PURE__ */ jsx("path", {
			d: "M3 8.5A2.5 2.5 0 0 1 5.5 6H18a3 3 0 0 1 3 3v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16V8.5Z",
			...stroke$3
		}), /* @__PURE__ */ jsx("path", {
			d: "M16 10.5h5v4h-5a2 2 0 0 1 0-4Z",
			...stroke$3
		})]
	});
	if (kind === "tree") return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: box,
		children: [
			/* @__PURE__ */ jsx("path", {
				d: "M12 21v-6",
				...stroke$3
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M12 15c0-3 2-5 5-5 0 3-2 5-5 5Zm0 0c0-3-2-5-5-5 0 3 2 5 5 5Z",
				...stroke$3
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M12 10c0-2.5 1.5-4 4-4 0 2.5-1.5 4-4 4Zm0 0c0-2.5-1.5-4-4-4 0 2.5 1.5 4 4 4Z",
				...stroke$3
			})
		]
	});
	return /* @__PURE__ */ jsxs("svg", {
		viewBox: "0 0 24 24",
		fill: "none",
		"aria-hidden": "true",
		className: box,
		children: [
			/* @__PURE__ */ jsx("path", {
				d: "M4 9h16v11H4z",
				...stroke$3
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M4 9 6.5 4h11L20 9",
				...stroke$3
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M12 4v16",
				...stroke$3
			})
		]
	});
}
/** Ảnh hỏng hoặc thiếu file thì lùi về icon, không để lỗ hổng trắng.
*  aspect cố định nên ảnh tải chậm không làm trang nhảy. */
function Thumb$1({ reward }) {
	const [broken, setBroken] = useState(false);
	return /* @__PURE__ */ jsx("div", {
		className: "relative aspect-[4/3] w-full overflow-hidden bg-surface-2",
		children: broken ? /* @__PURE__ */ jsx("span", {
			className: "grid h-full place-items-center text-body",
			children: /* @__PURE__ */ jsx(RewardIcon, { kind: reward.kind })
		}) : /* @__PURE__ */ jsx("img", {
			src: reward.img,
			alt: reward.name,
			loading: "lazy",
			decoding: "async",
			width: 800,
			height: 600,
			onError: () => setBroken(true),
			className: "h-full w-full object-cover"
		})
	});
}
function Rewards() {
	const { cur, next, pct, need } = tierProgress();
	const [spend, setSpend] = useState(SPEND_POINTS);
	const list = [...REWARDS].sort((a, b) => a.cost - b.cost);
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col pb-16",
		children: [
			/* @__PURE__ */ jsxs("header", {
				className: "pt-10 md:pt-14",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "display text-[28px] leading-9 md:text-[34px] md:leading-11",
					children: "Đổi quà bằng điểm xanh"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2 max-w-[62ch] text-base leading-7 text-body",
					children: "Điểm xanh cộng dồn từ những lần bạn giao rác đúng phân loại. Dùng điểm để đổi quà của EcoLink và các đối tác tái chế."
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "mt-7 grid overflow-hidden rounded-2xl border border-line bg-surface lg:grid-cols-[1.15fr_1fr]",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "px-5 py-6 md:px-8 md:py-7",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-xs font-semibold tracking-[0.16em] text-muted uppercase",
							children: "Điểm tiêu dùng"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-4xl leading-none font-bold tracking-tight tabular-nums text-brand md:text-5xl",
							children: fmt(spend)
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-3 text-[13px] leading-5 text-muted",
							children: "Dùng để đổi quà bên dưới. Đổi xong mới trừ."
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-6 border-t border-line-soft pt-5",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-xs font-semibold tracking-[0.16em] text-muted uppercase",
									children: "Điểm xếp hạng"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-3xl leading-none font-bold tracking-tight tabular-nums text-ink md:text-4xl",
									children: fmt(RANK_POINTS)
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-3 text-sm font-semibold text-ink",
									children: [
										"Hạng ",
										cur.name,
										next && /* @__PURE__ */ jsxs("span", {
											className: "font-normal text-muted",
											children: [" → ", next.name]
										})
									]
								}),
								/* @__PURE__ */ jsx("div", {
									className: "mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3",
									role: "progressbar",
									"aria-valuenow": pct,
									"aria-valuemin": 0,
									"aria-valuemax": 100,
									"aria-label": next ? `Tiến độ lên hạng ${next.name}` : "Đã đạt hạng cao nhất",
									children: /* @__PURE__ */ jsx("div", {
										className: "h-full rounded-full bg-brand",
										style: { width: `${pct}%` }
									})
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-2 text-[13px] leading-5 text-muted",
									children: [
										next ? `Cần thêm ${fmt(need)} điểm để lên hạng ${next.name}` : "Đã đạt hạng cao nhất",
										" · ",
										"đã đổi ",
										fmt(REDEEMED),
										" điểm"
									]
								})
							]
						})
					]
				}), /* @__PURE__ */ jsx("div", {
					className: "flex flex-col justify-center border-t border-line-soft px-5 py-6 md:px-8 md:py-7 lg:border-t-0 lg:border-l",
					children: /* @__PURE__ */ jsx(CheckIn, {
						balance: spend,
						onEarn: (n) => setSpend((s) => s + n)
					})
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "relative mt-10 overflow-hidden rounded-3xl bg-surface-2 px-5 py-6 md:px-8 md:py-8",
				children: [
					/* @__PURE__ */ jsx("div", {
						"aria-hidden": "true",
						className: "pointer-events-none absolute -top-28 -right-20 size-[440px] rounded-full border border-brand/12"
					}),
					/* @__PURE__ */ jsx("div", {
						"aria-hidden": "true",
						className: "pointer-events-none absolute -top-14 -right-6 size-[280px] rounded-full border border-brand/12"
					}),
					/* @__PURE__ */ jsxs("header", {
						className: "relative flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-2xl leading-8 font-bold tracking-tight text-brand",
							children: "Giải lớn mùa này"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted",
							children: "Điểm gấp 4 đến 13 lần quà thường"
						})]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "relative mt-1.5 max-w-[62ch] text-sm leading-6 text-body",
						children: "Dành riêng cho người giữ chuỗi điểm dài. Đổi bằng điểm tiêu dùng như mọi món khác, điểm xếp hạng của bạn không bị trừ."
					}),
					/* @__PURE__ */ jsx("ul", {
						className: "relative mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
						children: GRAND_PRIZES.map((g) => {
							const short = Math.max(g.cost - spend, 0);
							const can = short === 0;
							const pct = can ? 100 : Math.round(spend / g.cost * 100);
							return /* @__PURE__ */ jsxs("li", {
								className: "flex flex-col rounded-2xl bg-white shadow-[0_18px_40px_-26px_rgba(15,31,21,0.38)]",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "relative",
									children: [/* @__PURE__ */ jsx("img", {
										src: g.img,
										alt: g.name,
										loading: "lazy",
										decoding: "async",
										width: 400,
										height: 300,
										className: "aspect-[4/3] w-full rounded-t-2xl object-cover"
									}), /* @__PURE__ */ jsx("span", {
										"aria-hidden": "true",
										className: "absolute bottom-0 left-1/2 size-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-surface-2"
									})]
								}), /* @__PURE__ */ jsxs("div", {
									className: "flex flex-1 flex-col p-4 pt-6",
									children: [
										/* @__PURE__ */ jsx("h3", {
											className: "text-[15px] leading-6 font-bold text-ink",
											children: g.name
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mt-1 line-clamp-2 text-[13px] leading-5 text-muted",
											children: g.desc
										}),
										/* @__PURE__ */ jsx("div", {
											className: "mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3",
											role: "progressbar",
											"aria-valuenow": pct,
											"aria-valuemin": 0,
											"aria-valuemax": 100,
											"aria-label": `Tiến độ đổi ${g.name}`,
											children: /* @__PURE__ */ jsx("div", {
												className: `h-full rounded-full ${can ? "bg-brand-deep" : "bg-brand"}`,
												style: { width: `${pct}%` }
											})
										}),
										/* @__PURE__ */ jsx("p", {
											className: `mt-2 text-[13px] leading-5 ${can ? "font-semibold text-brand-deep" : "text-muted"}`,
											children: can ? "Đủ điểm, đổi được ngay" : `Cần thêm ${fmt(short)} điểm`
										}),
										g.details && /* @__PURE__ */ jsxs("details", {
											className: "mt-3",
											children: [/* @__PURE__ */ jsx("summary", {
												className: "cursor-pointer text-[13px] font-semibold text-brand",
												children: "Phần quà gồm gì"
											}), /* @__PURE__ */ jsx("ul", {
												className: "mt-2 flex flex-col gap-1.5",
												children: g.details.map((d) => /* @__PURE__ */ jsxs("li", {
													className: "flex gap-2 text-[12px] leading-5 text-muted",
													children: [/* @__PURE__ */ jsx("span", {
														"aria-hidden": "true",
														className: "mt-2 size-1 shrink-0 rounded-full bg-mint"
													}), /* @__PURE__ */ jsx("span", { children: d })]
												}, d))
											})]
										}),
										/* @__PURE__ */ jsxs("p", {
											className: "mt-auto flex items-center gap-2 pt-4",
											children: [
												/* @__PURE__ */ jsx("img", {
													src: COIN,
													alt: "",
													width: 24,
													height: 24,
													className: "size-6 shrink-0"
												}),
												/* @__PURE__ */ jsx("span", {
													className: "text-lg leading-6 font-bold tabular-nums text-ink",
													children: fmt(g.cost)
												}),
												/* @__PURE__ */ jsx("span", {
													className: "text-xs font-medium text-muted",
													children: "điểm"
												})
											]
										})
									]
								})]
							}, g.id);
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "mt-10",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
						children: [/* @__PURE__ */ jsx("h2", {
							className: "text-lg leading-7 font-bold tracking-tight text-ink",
							children: "Phần quà đang mở"
						}), /* @__PURE__ */ jsxs("p", {
							className: "text-sm text-muted",
							children: [list.length, " món, sắp theo giá tăng dần"]
						})]
					}),
					/* @__PURE__ */ jsx("ul", {
						className: "mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3",
						children: list.map((r) => {
							const enough = spend >= r.cost;
							const soldOut = r.stock === 0;
							const can = enough && !soldOut;
							const stock = r.stock === null ? "Không giới hạn" : soldOut ? "Hết hàng" : r.stock <= 15 ? `Chỉ còn ${r.stock}` : `Còn ${r.stock}`;
							return /* @__PURE__ */ jsxs("li", {
								className: "card flex flex-col overflow-hidden",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "relative",
									children: [/* @__PURE__ */ jsx(Thumb$1, { reward: r }), r.stock !== null && /* @__PURE__ */ jsx("span", {
										className: `absolute top-3 left-3 rounded-full px-2.5 py-1 text-[11px] font-semibold ${soldOut ? "bg-surface-3 text-ink" : r.stock <= 15 ? "bg-brand text-white" : "bg-surface text-body"}`,
										children: stock
									})]
								}), /* @__PURE__ */ jsxs("div", {
									className: "flex flex-1 flex-col p-4 sm:p-5",
									children: [
										/* @__PURE__ */ jsx("h3", {
											className: "text-[15px] leading-6 font-bold text-ink",
											children: r.name
										}),
										/* @__PURE__ */ jsx("p", {
											className: "mt-1 text-sm leading-6 text-body",
											children: r.desc
										}),
										/* @__PURE__ */ jsxs("div", {
											className: "mt-auto flex items-end justify-between gap-3 pt-5",
											children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
												className: `text-[15px] leading-6 font-bold tabular-nums ${can ? "text-brand" : "text-muted"}`,
												children: [
													fmt(r.cost),
													" ",
													/* @__PURE__ */ jsx("span", {
														className: "text-xs font-medium",
														children: "điểm"
													})
												]
											}), !enough && /* @__PURE__ */ jsxs("p", {
												className: "text-xs text-muted",
												children: [
													"Thiếu ",
													fmt(r.cost - spend),
													" điểm"
												]
											})] }), /* @__PURE__ */ jsx("button", {
												type: "button",
												disabled: !can,
												className: "btn btn-primary h-10 min-w-[104px]",
												children: soldOut ? "Hết hàng" : "Đổi ngay"
											})]
										})
									]
								})]
							}, r.id);
						})
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-6 max-w-[68ch] text-sm leading-6 text-muted",
						children: "Đổi quà chỉ trừ điểm tiêu dùng, điểm xếp hạng giữ nguyên nên bạn không bị tụt hạng. Quà vật lý được giao tại nhà trong 3 đến 5 ngày làm việc; phiếu giảm giá có hiệu lực từ lần thanh toán kế tiếp."
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "mt-10",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-lg leading-7 font-bold tracking-tight text-ink",
					children: "Kiếm điểm thế nào"
				}), /* @__PURE__ */ jsx("ol", {
					className: "mt-5 grid gap-y-5 sm:grid-cols-3 sm:gap-x-8",
					children: EARN.map((e, i) => /* @__PURE__ */ jsxs("li", {
						className: "flex items-start gap-3.5",
						children: [/* @__PURE__ */ jsx("span", {
							className: "grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white",
							children: i + 1
						}), /* @__PURE__ */ jsxs("div", {
							className: "pt-0.5",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm leading-5 font-semibold text-ink",
								children: e.title
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 text-[13px] leading-5 text-muted",
								children: e.desc
							})]
						})]
					}, e.title))
				})]
			})
		]
	});
}
//#endregion
//#region src/components/Leaderboard.tsx
/** Bảng xếp hạng theo điểm xếp hạng.
*
*  Top 3 dựng thành **bục**: hạng nhất ở giữa và cao hơn, 2 – 1 – 3 (nên phải
*  đảo thứ tự hiển thị). Không dùng màu vàng/bạc cho kim loại — app chỉ có một
*  sắc xanh chủ đạo, phân cấp bằng chiều cao + nền brand + cỡ chữ.
*
*  Hạng 4 trở xuống là danh sách gọn. Dòng của bạn luôn tô nền và ghi rõ còn
*  kém người trên bao nhiêu, vì bảng xếp hạng chỉ có tác dụng khi biết mình ở
*  đâu và có ai để vượt. */
function Leaderboard() {
	const [first, second, third] = LEADERBOARD;
	const rest = LEADERBOARD.slice(3);
	return /* @__PURE__ */ jsxs("section", {
		className: "mt-10 first:mt-0",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-lg leading-7 font-bold tracking-tight text-ink",
					children: "Xếp hạng người dùng"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted",
					children: "Theo điểm xếp hạng, cập nhật hằng ngày"
				})]
			}),
			/* @__PURE__ */ jsxs("ol", {
				className: "mt-6 grid grid-cols-3 items-end gap-2 sm:gap-4",
				children: [
					/* @__PURE__ */ jsx(PodiumCard, {
						rank: 2,
						person: second
					}),
					/* @__PURE__ */ jsx(PodiumCard, {
						rank: 1,
						person: first
					}),
					/* @__PURE__ */ jsx(PodiumCard, {
						rank: 3,
						person: third
					})
				]
			}),
			/* @__PURE__ */ jsx("ol", {
				className: "card mt-4 divide-y divide-line-soft overflow-hidden",
				children: rest.map((r, i) => {
					const rank = i + 4;
					const above = LEADERBOARD[i + 2]?.points;
					return /* @__PURE__ */ jsxs("li", {
						className: `flex items-center gap-3 px-4 py-3 sm:px-5 ${r.you ? "bg-brand/8" : ""}`,
						children: [
							/* @__PURE__ */ jsx("span", {
								className: "w-6 shrink-0 text-sm font-semibold tabular-nums text-muted",
								children: rank
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ jsxs("p", {
									className: "truncate text-sm font-semibold text-ink",
									children: [r.name, r.you && /* @__PURE__ */ jsx("span", {
										className: "ml-1.5 text-xs text-brand",
										children: "(bạn)"
									})]
								}), /* @__PURE__ */ jsx("p", {
									className: "truncate text-xs text-muted",
									children: r.you && above ? `Cần ${fmt(above - r.points)} điểm để vượt người trên` : r.area
								})]
							}),
							/* @__PURE__ */ jsx("span", {
								className: "shrink-0 text-sm font-bold tabular-nums text-ink",
								children: fmt(r.points)
							})
						]
					}, r.name);
				})
			})
		]
	});
}
function PodiumCard({ rank, person }) {
	const top = rank === 1;
	const shell = top ? "bg-brand text-white shadow-[0_10px_28px_rgba(15,31,21,0.16)]" : "border border-line bg-surface text-ink";
	const rise = top ? "-translate-y-8 pb-8 sm:-translate-y-10 sm:pb-12" : rank === 2 ? "-translate-y-2" : "";
	const size = top ? "size-16 sm:size-20" : rank === 2 ? "size-11 sm:size-14" : "size-9 sm:size-12";
	const font = top ? "text-2xl" : rank === 2 ? "text-base sm:text-lg" : "text-sm sm:text-base";
	const name = top ? "text-[15px] sm:text-base" : "text-xs sm:text-sm";
	const points = top ? "text-2xl sm:text-3xl" : "text-sm sm:text-base";
	return /* @__PURE__ */ jsxs("li", {
		className: `flex flex-col items-center rounded-2xl px-2 pt-4 pb-4 text-center sm:px-4 sm:pt-5 sm:pb-5 ${rise} ${shell}`,
		children: [
			/* @__PURE__ */ jsx("span", {
				className: `grid shrink-0 place-items-center rounded-full font-bold tabular-nums ${top ? "bg-white/22 text-white ring-2 ring-white/40" : rank === 2 ? "bg-brand/14 text-brand" : "bg-surface-3 text-ink"} ${size} ${font}`,
				children: rank
			}),
			/* @__PURE__ */ jsx("p", {
				className: `mt-3 w-full truncate font-bold ${name}`,
				children: person.name
			}),
			/* @__PURE__ */ jsx("p", {
				className: `w-full truncate text-[11px] sm:text-xs ${top ? "text-white/70" : "text-muted"}`,
				children: person.area
			}),
			/* @__PURE__ */ jsx("p", {
				className: `mt-2 w-full truncate font-bold tabular-nums ${top ? "text-white" : "text-ink"} ${points}`,
				children: fmt(person.points)
			})
		]
	});
}
//#endregion
//#region src/pages/Leaderboard.tsx
/** Bảng xếp hạng người dùng.
*
*  Tách khỏi `/rewards` và đặt ở phần Khám phá của menu vì xếp hạng là thứ
*  người dùng vào xem chứ không phải thứ họ phải đổi điểm mới thấy: giữ nó
*  trong trang đổi thưởng thì phải cuộn qua 6 món quà và 3 giải lớn mới tới.
*
*  Component `Leaderboard` giữ nguyên vì dùng chung cho cả trang này. */
function LeaderboardPage() {
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col pb-16",
		children: [
			/* @__PURE__ */ jsxs("header", {
				className: "pt-10 md:pt-14",
				children: [/* @__PURE__ */ jsx("h1", {
					className: "display text-[28px] leading-9 md:text-[34px] md:leading-11",
					children: "Xếp hạng người dùng"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2 max-w-[62ch] text-base leading-7 text-body",
					children: "Xếp theo điểm xếp hạng — tức là điểm tích luỹ trọn đời, không bao giờ bị trừ khi bạn đổi quà. Chuỗi điểm của bạn còn nguyên."
				})]
			}),
			/* @__PURE__ */ jsx(Leaderboard, {}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-8 max-w-[68ch] text-sm leading-6 text-muted",
				children: "Điểm xếp hạng cộng dồn từ giao rác đúng phân loại và điểm danh hằng ngày. Hạng được tính lại mỗi chu kỳ do Admin cấu hình, đang là chu kỳ tháng."
			})
		]
	});
}
//#endregion
//#region src/lib/api.ts
var ApiError = class extends Error {
	status;
	messageCode;
	errors;
	isNetworkError;
	constructor(opts) {
		super(opts.message);
		this.name = "ApiError";
		this.status = opts.status ?? 0;
		this.messageCode = opts.messageCode;
		this.errors = opts.errors;
		this.isNetworkError = opts.isNetworkError ?? false;
	}
};
var FALLBACK_HOSTS = [
	"",
	"http://localhost:5000",
	"http://localhost:5017"
];
var resolvedHost = null;
function readAccessToken() {
	if (typeof localStorage === "undefined") return null;
	try {
		const direct = localStorage.getItem("ecolink:token");
		if (direct) return direct;
		const rawUser = localStorage.getItem("ecolink:user");
		if (!rawUser) return null;
		const parsed = JSON.parse(rawUser);
		return parsed?.token ?? parsed?.accessToken ?? null;
	} catch {
		return null;
	}
}
async function fetchWithAutoHost(path, init) {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	if (resolvedHost !== null) return fetch(`${resolvedHost}${normalizedPath}`, init);
	let lastErr = null;
	for (const host of FALLBACK_HOSTS) try {
		const res = await fetch(`${host}${normalizedPath}`, init);
		const ct = res.headers.get("content-type") ?? "";
		const isProxyDown = res.status === 502 || res.status === 504;
		const isUnexpectedHtml = host === "" && ct.includes("text/html") && res.status === 404;
		if (isProxyDown || isUnexpectedHtml) continue;
		resolvedHost = host;
		return res;
	} catch (err) {
		if (err?.name === "AbortError") throw err;
		lastErr = err;
	}
	throw new ApiError({
		message: "Không thể kết nối tới máy chủ EcoLink Backend (localhost:5000). Vui lòng kiểm tra dịch vụ WebApi đã khởi động chưa.",
		isNetworkError: true,
		errors: lastErr instanceof Error ? [lastErr.message] : void 0
	});
}
async function apiRequest(path, options = {}) {
	const headers = new Headers(options.headers);
	if (!headers.has("Accept")) headers.set("Accept", "application/json");
	if (options.body && typeof options.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
	const token = readAccessToken();
	if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);
	let res;
	try {
		res = await fetchWithAutoHost(path, {
			...options,
			headers
		});
	} catch (err) {
		if (err instanceof ApiError) throw err;
		if (err?.name === "AbortError") throw err;
		throw new ApiError({
			message: "Không thể kết nối tới máy chủ EcoLink Backend. Vui lòng kiểm tra kết nối mạng hoặc khởi động Backend.",
			isNetworkError: true
		});
	}
	const text = await res.text();
	let parsed = null;
	if (text) try {
		parsed = JSON.parse(text);
	} catch {
		parsed = null;
	}
	if (!res.ok) {
		const env = parsed;
		throw new ApiError({
			status: res.status,
			messageCode: env?.messageCode ?? void 0,
			message: env?.message || (res.status === 404 ? "Không tìm thấy dữ liệu yêu cầu." : `Yêu cầu thất bại (HTTP ${res.status}).`),
			errors: Array.isArray(env?.errors) ? env.errors : void 0
		});
	}
	if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "success" in parsed && typeof parsed.success === "boolean") {
		const env = parsed;
		if (!env.success) throw new ApiError({
			status: res.status,
			messageCode: env.messageCode ?? void 0,
			message: env.message || "Xử lý yêu cầu không thành công.",
			errors: env.errors ?? void 0
		});
		return env;
	}
	return {
		success: true,
		data: parsed,
		messageCode: "MSG-GEN-01",
		message: null
	};
}
//#endregion
//#region src/lib/wasteScanApi.ts
var DEFAULT_AI_MODELS = [
	{
		id: "yolov8_detect",
		name: "YOLOv8 Detection (Khuyên dùng - Định vị & Cắt nền)",
		family: "Object Detection (Ultralytics)",
		is_ready: true
	},
	{
		id: "efficientnet_b0",
		name: "EfficientNet-B0 (Độ chính xác cao 92.3%)",
		family: "CNN (Torchvision)",
		is_ready: true
	},
	{
		id: "mobilenet_v3",
		name: "MobileNetV3-Small (Siêu nhẹ, tối ưu di động)",
		family: "CNN (Torchvision)",
		is_ready: true
	},
	{
		id: "yolov8n",
		name: "YOLOv8 Nano Classifier (Tốc độ nhanh)",
		family: "CNN (Ultralytics)",
		is_ready: true
	}
];
var WASTE_CATEGORY_META = {
	plastic: {
		code: "plastic",
		shortName: "Nhựa tái chế (PET / HDPE)",
		group: "Nhựa",
		badge: "Vật liệu có giá trị thu mua",
		priceRange: "5.000 – 7.500",
		priceUnit: "đ / kg",
		recyclable: true,
		handoverWasteId: "pet"
	},
	paper: {
		code: "paper",
		shortName: "Giấy báo & Văn phòng",
		group: "Giấy",
		badge: "Vật liệu có giá trị thu mua",
		priceRange: "3.800 – 5.000",
		priceUnit: "đ / kg",
		recyclable: true,
		handoverWasteId: "office-paper"
	},
	cardboard: {
		code: "cardboard",
		shortName: "Bìa Carton (OCC)",
		group: "Giấy",
		badge: "Vật liệu dễ thu gom tận nơi",
		priceRange: "3.200 – 4.500",
		priceUnit: "đ / kg",
		recyclable: true,
		handoverWasteId: "carton"
	},
	metal: {
		code: "metal",
		shortName: "Kim loại & Vỏ lon nhôm",
		group: "Kim loại",
		badge: "Phế liệu giá trị cao",
		priceRange: "14.000 – 28.000",
		priceUnit: "đ / kg",
		recyclable: true,
		handoverWasteId: "aluminum"
	},
	glass: {
		code: "glass",
		shortName: "Chai lọ Thủy tinh",
		group: "Thủy tinh",
		badge: "Vật liệu tái chế tuần hoàn",
		priceRange: "1.500 – 2.500",
		priceUnit: "đ / kg",
		recyclable: true,
		handoverWasteId: "glass"
	},
	trash: {
		code: "trash",
		shortName: "Rác sinh hoạt thông thường",
		group: "Hữu cơ",
		badge: "Không thuộc danh mục thu mua",
		priceRange: "Không thu mua",
		priceUnit: "Bỏ thùng rác đô thị",
		recyclable: false,
		handoverWasteId: "organic"
	}
};
var AI_CLASS_OPTIONS = [
	{
		code: "plastic",
		label: "Nhựa tái chế (Plastic)"
	},
	{
		code: "paper",
		label: "Giấy báo & Tài liệu (Paper)"
	},
	{
		code: "cardboard",
		label: "Bìa Carton (Cardboard)"
	},
	{
		code: "metal",
		label: "Kim loại & Vỏ lon (Metal)"
	},
	{
		code: "glass",
		label: "Thủy tinh (Glass)"
	},
	{
		code: "trash",
		label: "Rác sinh hoạt khác (Trash)"
	}
];
function getCategoryMeta(code) {
	const normalized = (code ?? "").trim().toLowerCase();
	return WASTE_CATEGORY_META[normalized] ?? {
		code: normalized || "unknown",
		shortName: code || "Chưa xác định",
		group: "Nhựa",
		badge: "Cần kiểm tra phân loại",
		priceRange: "Theo thỏa thuận",
		priceUnit: "đ / kg",
		recyclable: false,
		handoverWasteId: "pet"
	};
}
/** Tách chuỗi các bước sơ chế ("1. ...\n2. ...") hoặc mảng thành danh sách câu sạch. */
function parsePreparationSteps(raw) {
	if (!raw) return [];
	return (Array.isArray(raw) ? raw : raw.split(/\r?\n|(?=\d+\.\s)/g).map((s) => s.trim()).filter(Boolean)).map((line) => line.replace(/^\d+[.)]\s*/, "").trim()).filter(Boolean);
}
/** Gửi file ảnh rác tới POST /api/v1/waste-scan/classify (UC-CLS-01). */
async function classifyWasteImage(file, model = "yolov8_detect", signal) {
	const form = new FormData();
	form.append("file", file, file.name || "scan.jpg");
	form.append("model", model);
	return apiRequest("/api/v1/waste-scan/classify", {
		method: "POST",
		body: form,
		signal
	});
}
/** Tải ảnh mẫu tĩnh trên trình duyệt thành đối tượng File thật để gửi qua AI pipeline. */
async function loadSampleImageAsFile(assetUrl, fileName = "sample-pet-bottle.png") {
	const res = await fetch(assetUrl);
	if (!res.ok) throw new Error("Không tải được ảnh mẫu để phân tích.");
	const blob = await res.blob();
	const ext = blob.type === "image/webp" ? "webp" : blob.type === "image/jpeg" ? "jpg" : "png";
	const safeName = fileName.replace(/\.\w+$/, `.${ext}`);
	return new File([blob], safeName, { type: blob.type || "image/png" });
}
/** Lấy danh sách các mô hình AI sẵn sàng từ GET /api/v1/waste-scan/models. */
async function fetchAiModels(signal) {
	const res = await apiRequest("/api/v1/waste-scan/models", {
		method: "GET",
		signal
	});
	if (res.data && Array.isArray(res.data.models) && res.data.models.length > 0) return res.data;
	return {
		default_model: "yolov8_detect",
		models: DEFAULT_AI_MODELS
	};
}
/** Lấy toàn bộ quy tắc phân loại rác tĩnh từ Rule Engine (GET /api/v1/waste-scan/rules). */
async function fetchSortingRules(signal) {
	const res = await apiRequest("/api/v1/waste-scan/rules", {
		method: "GET",
		signal
	});
	return Array.isArray(res.data) ? res.data : [];
}
/** Gửi báo cáo AI nhận diện sai (POST /api/v1/waste-scan/feedback - BR-CLS-05). */
async function submitAiFeedback(payload) {
	const res = await apiRequest("/api/v1/waste-scan/feedback", {
		method: "POST",
		body: JSON.stringify({
			imageUrl: payload.imageUrl ?? "",
			predictedLabel: payload.predictedLabel,
			confidenceScore: payload.confidenceScore,
			userReportedLabel: payload.userReportedLabel,
			note: payload.note ?? ""
		})
	});
	return {
		success: res.success,
		message: res.message || "Cảm ơn bạn đã phản hồi! Dữ liệu đã được chuyển tới Nhân viên vận hành để kiểm chứng."
	};
}
//#endregion
//#region src/lib/recyclerDiscoveryApi.ts
var DISCOVERY_CATEGORIES = [
	{
		value: "",
		label: "Tất cả phế liệu"
	},
	{
		value: "plastic",
		label: "Nhựa (Plastic)"
	},
	{
		value: "paper",
		label: "Giấy báo (Paper)"
	},
	{
		value: "cardboard",
		label: "Bìa Carton"
	},
	{
		value: "metal",
		label: "Kim loại & Lon"
	},
	{
		value: "glass",
		label: "Thủy tinh"
	}
];
var RADIUS_OPTIONS = [
	2,
	5,
	10,
	25
];
/** Các toạ độ khu vực thực tế để người dùng chọn nhanh khi dùng máy tính để bàn
*  hoặc khi trình duyệt từ chối cấp quyền định vị GPS (MSG-MTH-02). */
var LOCATION_PRESETS = [
	{
		id: "hcm-q1",
		label: "Quận 1, TP.HCM",
		address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1, TP.HCM",
		lat: 10.7785,
		lng: 106.7009
	},
	{
		id: "hcm-bt",
		label: "Bình Thạnh, TP.HCM",
		address: "120 Nguyễn Hữu Cảnh, P. 22, Quận Bình Thạnh, TP.HCM",
		lat: 10.7938,
		lng: 106.7182
	},
	{
		id: "hcm-tb",
		label: "Tân Bình, TP.HCM",
		address: "88 Cộng Hòa, Phường 4, Quận Tân Bình, TP.HCM",
		lat: 10.7995,
		lng: 106.657
	},
	{
		id: "hcm-q7",
		label: "Quận 7, TP.HCM",
		address: "Nguyễn Thị Thập, P. Tân Phú, Quận 7, TP.HCM",
		lat: 10.7324,
		lng: 106.7215
	},
	{
		id: "hn-cg",
		label: "Cầu Giấy, Hà Nội",
		address: "Đường Xuân Thủy, Quận Cầu Giấy, Hà Nội",
		lat: 21.0368,
		lng: 105.7825
	}
];
function isDiscoverableCategory(val) {
	if (!val) return false;
	const v = val.trim().toLowerCase();
	return v === "plastic" || v === "paper" || v === "cardboard" || v === "metal" || v === "glass";
}
/** Tìm kiếm các cơ sở thu gom đã xác minh (Verified) & đang mở cửa (Online) quanh GPS (UC U-05). */
async function searchNearbyRecyclers(filter, signal) {
	const params = new URLSearchParams();
	params.set("lat", String(filter.lat));
	params.set("lng", String(filter.lng));
	params.set("radiusKm", String(filter.radiusKm ?? 10));
	params.set("sortBy", filter.sortBy ?? "distance");
	if (filter.category && isDiscoverableCategory(filter.category)) params.set("category", filter.category.trim().toLowerCase());
	if (filter.keyword && filter.keyword.trim()) params.set("keyword", filter.keyword.trim());
	return apiRequest(`/api/v1/recyclers/nearby?${params.toString()}`, {
		method: "GET",
		signal
	});
}
/** Xem chi tiết hồ sơ công khai, giờ mở cửa và bảng giá niêm yết của 1 cơ sở thu gom (UC U-05). */
async function getRecyclerPublicDetail(recyclerId, lat, lng, signal) {
	const params = new URLSearchParams();
	if (typeof lat === "number" && lat !== 0) params.set("lat", String(lat));
	if (typeof lng === "number" && lng !== 0) params.set("lng", String(lng));
	const qs = params.toString();
	return (await apiRequest(`/api/v1/recyclers/${encodeURIComponent(recyclerId)}${qs ? `?${qs}` : ""}`, {
		method: "GET",
		signal
	})).data;
}
/**
* Chiếu toạ độ GPS thật (lat, lng) của cơ sở thu mua sang vị trí phần trăm (left%, top%)
* trên khung bản đồ xung quanh tâm người dùng (50%, 50%) theo bán kính tìm kiếm.
*/
function projectPartnerPinPosition(userLat, userLng, partnerLat, partnerLng, radiusKm, indexFallback = 0) {
	const safeRadius = Math.max(radiusKm, 1);
	const kmPerDegLat = 111.32;
	const kmPerDegLng = 111.32 * Math.cos(userLat * Math.PI / 180);
	const dNorthKm = (partnerLat - userLat) * kmPerDegLat;
	const dEastKm = (partnerLng - userLng) * kmPerDegLng;
	const dist = Math.hypot(dEastKm, dNorthKm);
	if (dist < .08) {
		const angle = (indexFallback + 1) * Math.PI / 3;
		return {
			left: `${Math.round(50 + Math.cos(angle) * 14)}%`,
			top: `${Math.round(50 - Math.sin(angle) * 14)}%`
		};
	}
	const scale = Math.min(1, dist / safeRadius);
	const ux = dEastKm / dist;
	const uy = dNorthKm / dist;
	const offsetPct = 12 + scale * 25;
	const left = Math.max(14, Math.min(86, 50 + ux * offsetPct));
	const top = Math.max(16, Math.min(84, 50 - uy * offsetPct));
	return {
		left: `${left.toFixed(1)}%`,
		top: `${top.toFixed(1)}%`
	};
}
function formatDistance(distanceKm) {
	if (!Number.isFinite(distanceKm) || distanceKm <= 0) return "Gần bạn";
	if (distanceKm < 1) return `${Math.max(50, Math.round(distanceKm * 1e3))} m`;
	return `${distanceKm.toLocaleString("vi-VN", { maximumFractionDigits: 2 })} km`;
}
function formatVnd(amount) {
	return `${Math.round(amount).toLocaleString("vi-VN")} đ`;
}
//#endregion
//#region src/pages/Scanner.tsx
var BAR_COLORS = [
	"var(--color-brand)",
	"var(--color-mint)",
	"var(--color-sage-line)"
];
function mapApiToViewModel(payload, messageCode, selectedModelName) {
	const { aiResult, sortingGuide } = payload;
	const top = aiResult.topPrediction;
	const rawConf = top?.confidence ?? 0;
	const confPct = Math.round(rawConf * 1e3) / 10;
	const isOod = messageCode === "MSG-CLS-02" || aiResult.isOutOfDistribution || !top || rawConf < (aiResult.confidenceThreshold || .6);
	const code = (sortingGuide?.categoryCode || top?.label || "unknown").toLowerCase();
	const meta = getCategoryMeta(code);
	const breakdown = (aiResult.predictions && aiResult.predictions.length > 0 ? aiResult.predictions.slice(0, 3) : top ? [top] : []).map((p, idx) => ({
		label: p.displayName || p.label,
		value: Math.max(0, Math.min(100, Math.round(p.confidence * 100))),
		color: BAR_COLORS[idx] ?? BAR_COLORS[2]
	}));
	const steps = parsePreparationSteps(sortingGuide?.preparationSteps);
	const latencyText = aiResult.inferenceTimeMs > 0 ? ` • ${aiResult.inferenceTimeMs.toFixed(1)} ms` : "";
	const resolvedModelName = aiResult.modelName || selectedModelName || aiResult.modelUsed || "YOLOv8 Detection";
	return {
		isOod,
		messageCode,
		message: payload.message,
		categoryCode: code,
		material: sortingGuide?.categoryName || top?.displayName || meta.shortName,
		tag: top?.displayName || meta.shortName,
		badge: isOod ? "Độ tin cậy thấp (< 60%) — Cần chụp rõ hơn" : meta.badge,
		description: isOod ? payload.message : sortingGuide?.handlingAction || "Phân loại đúng quy định giúp tăng giá trị thu mua và tích Điểm Xanh.",
		binColor: sortingGuide?.standardBinColor,
		hazardWarning: sortingGuide?.hazardWarning,
		steps: steps.length > 0 ? steps : SCAN_RESULT.steps,
		price: {
			label: meta.recyclable ? "ĐƠN GIÁ THAM KHẢO" : "PHƯƠNG ÁN XỬ LÝ",
			value: meta.priceRange,
			unit: meta.priceUnit
		},
		confidencePct: Math.round(confPct),
		rawConfidence: rawConf,
		modelLabel: `${resolvedModelName}${latencyText}`,
		breakdown,
		recyclable: !isOod && meta.recyclable
	};
}
function buildOfflineDemoViewModel() {
	return {
		isOfflineDemo: true,
		isOod: false,
		messageCode: "MSG-CLS-01",
		message: "Đang hiển thị kết quả mẫu nội bộ (Dịch vụ AI chưa kết nối).",
		categoryCode: "plastic",
		material: SCAN_RESULT.material,
		tag: SCAN_RESULT.tag,
		badge: `${SCAN_RESULT.badge} (Mô phỏng Offline)`,
		description: SCAN_RESULT.description,
		binColor: "Cam",
		hazardWarning: "Không trộn lẫn chai nhựa từng chứa hóa chất độc hại.",
		steps: SCAN_RESULT.steps,
		price: SCAN_RESULT.price,
		confidencePct: SCAN_RESULT.confidence,
		rawConfidence: SCAN_RESULT.confidence / 100,
		modelLabel: `${SCAN_RESULT.model} (Offline Preview)`,
		breakdown: SCAN_RESULT.breakdown,
		recyclable: true
	};
}
function Scanner() {
	const [phase, setPhase] = useState("idle");
	const [file, setFile] = useState(null);
	const [useSample, setUseSample] = useState(false);
	const [camera, setCamera] = useState(false);
	const [models, setModels] = useState(DEFAULT_AI_MODELS);
	const [selectedModel, setSelectedModel] = useState("yolov8_detect");
	const [apiOnline, setApiOnline] = useState(null);
	const [scanResult, setScanResult] = useState(null);
	const [scanError, setScanError] = useState(null);
	const abortRef = useRef(null);
	useEffect(() => {
		const controller = new AbortController();
		fetchAiModels(controller.signal).then((payload) => {
			if (payload.models.length > 0) setModels(payload.models);
			if (payload.default_model) {
				const hasDetect = payload.models.some((m) => m.id === "yolov8_detect" && m.is_ready !== false);
				setSelectedModel(hasDetect ? "yolov8_detect" : payload.default_model);
			}
			setApiOnline(true);
		}).catch(() => {
			if (!controller.signal.aborted) setApiOnline(false);
		});
		return () => {
			controller.abort();
			abortRef.current?.abort();
		};
	}, []);
	const pick = (f) => {
		abortRef.current?.abort();
		setFile(f);
		setUseSample(false);
		setScanError(null);
		setScanResult(null);
		setPhase("idle");
	};
	const pickSample = () => {
		abortRef.current?.abort();
		setFile(null);
		setUseSample(true);
		setScanError(null);
		setScanResult(null);
		setPhase("idle");
	};
	const reset = () => {
		abortRef.current?.abort();
		setFile(null);
		setUseSample(false);
		setScanError(null);
		setScanResult(null);
		setPhase("idle");
	};
	const scan = async () => {
		if (!Boolean(file || useSample)) return;
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setScanError(null);
		setPhase("scanning");
		const startedAt = Date.now();
		try {
			const res = await classifyWasteImage(file ?? await loadSampleImageAsFile(SCAN_RESULT.image, "sample-pet-bottle.png"), selectedModel, controller.signal);
			const elapsed = Date.now() - startedAt;
			if (elapsed < 550) await new Promise((resolve) => setTimeout(resolve, 550 - elapsed));
			if (controller.signal.aborted) return;
			const modelMeta = models.find((m) => m.id === selectedModel);
			const vm = mapApiToViewModel(res.data, res.messageCode, modelMeta?.name ?? selectedModel);
			setApiOnline(true);
			setScanResult(vm);
			setPhase("done");
		} catch (err) {
			if (controller.signal.aborted || err?.name === "AbortError") return;
			if (err instanceof ApiError) {
				const isServiceDown = err.isNetworkError || err.messageCode === "MSG-CLS-03";
				if (err.isNetworkError) setApiOnline(false);
				setScanError({
					message: err.message,
					code: err.messageCode,
					canPreviewOffline: isServiceDown
				});
			} else setScanError({
				message: err instanceof Error ? err.message : "Đã xảy ra lỗi khi phân tích hình ảnh.",
				canPreviewOffline: true
			});
			setPhase("idle");
		}
	};
	const previewOfflineDemo = () => {
		setScanError(null);
		setScanResult(buildOfflineDemoViewModel());
		setPhase("done");
	};
	const preview = file ?? (useSample || phase !== "idle" ? sampleShot : null);
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col py-5 md:py-6",
		children: [/* @__PURE__ */ jsxs("header", {
			className: "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
			children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("p", {
				className: "flex items-center gap-1.5 text-[13px] text-body",
				children: [
					"Hệ sinh thái",
					/* @__PURE__ */ jsx(Separator, {}),
					/* @__PURE__ */ jsx("span", {
						className: "font-medium text-brand-deep",
						children: "Nhận diện thông minh"
					})
				]
			}), /* @__PURE__ */ jsx("h1", {
				className: "display mt-1 text-[22px] leading-7 md:text-2xl md:leading-8",
				children: "Phân loại & Định giá rác tái chế"
			})] }), /* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-2.5",
				children: [/* @__PURE__ */ jsxs("label", {
					className: "flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-body",
					children: [/* @__PURE__ */ jsx("span", {
						className: "font-semibold text-ink",
						children: "Mô hình AI:"
					}), /* @__PURE__ */ jsx("select", {
						"aria-label": "Chọn mô hình nhận diện AI",
						value: selectedModel,
						disabled: phase === "scanning",
						onChange: (e) => setSelectedModel(e.target.value),
						className: "max-w-[230px] truncate bg-transparent font-medium text-brand-deep focus:outline-none disabled:opacity-60",
						children: models.map((m) => /* @__PURE__ */ jsxs("option", {
							value: m.id,
							disabled: m.is_ready === false,
							children: [m.name, m.is_ready === false ? " (Chưa nạp)" : ""]
						}, m.id))
					})]
				}), /* @__PURE__ */ jsxs("p", {
					className: "chip bg-surface-2 text-body",
					children: [/* @__PURE__ */ jsx("i", { className: `size-1.5 rounded-full ${apiOnline === false ? "bg-warn" : "bg-brand"}` }), apiOnline === false ? "Chưa kết nối AI Server" : "AI Vision & Rule Engine sẵn sàng"]
				})]
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "mt-4 grid gap-5 md:grid-cols-12",
			children: [/* @__PURE__ */ jsxs("section", {
				className: "flex flex-col gap-3 md:col-span-6",
				children: [camera ? /* @__PURE__ */ jsx(CameraPanel, {
					onShoot: (f) => {
						setCamera(false);
						pick(f);
					},
					onClose: () => setCamera(false)
				}) : phase === "idle" && !preview ? /* @__PURE__ */ jsx(UploadZone, {
					onPick: pick,
					onSample: pickSample,
					onCamera: () => setCamera(true)
				}) : preview ? /* @__PURE__ */ jsx(Preview, {
					file: preview,
					scanning: phase === "scanning",
					done: phase === "done",
					result: scanResult,
					onReset: reset,
					onPick: pick,
					onCamera: () => setCamera(true)
				}) : null, phase === "done" && !camera && scanResult && !scanResult.isOod && /* @__PURE__ */ jsxs("div", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-center justify-between gap-2",
							children: [/* @__PURE__ */ jsx("h2", {
								className: "text-base leading-6 font-bold tracking-tight text-ink",
								children: "Hướng dẫn xử lý nhanh (Rule Engine)"
							}), scanResult.binColor && /* @__PURE__ */ jsxs("span", {
								className: "rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep",
								children: ["Thùng rác chuẩn: ", scanResult.binColor]
							})]
						}),
						/* @__PURE__ */ jsx("ol", {
							className: "grid gap-2 sm:grid-cols-2",
							children: scanResult.steps.map((step, i) => /* @__PURE__ */ jsxs("li", {
								className: "flex items-start gap-2.5 rounded-lg border border-line-soft bg-surface-2/60 px-3 py-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "grid size-5 shrink-0 place-items-center rounded-full bg-brand/10 text-[11px] font-bold text-brand-deep",
									children: i + 1
								}), /* @__PURE__ */ jsx("span", {
									className: "text-[13px] leading-5 text-ink",
									children: step
								})]
							}, `${i}-${step}`))
						}),
						scanResult.hazardWarning && /* @__PURE__ */ jsxs("p", {
							className: "rounded-lg border border-warn/25 bg-warn/5 px-3 py-2 text-xs leading-5 text-body",
							children: [
								/* @__PURE__ */ jsx("b", {
									className: "text-warn",
									children: "Lưu ý an toàn:"
								}),
								" ",
								scanResult.hazardWarning
							]
						})
					]
				})]
			}), /* @__PURE__ */ jsx("section", {
				className: "md:col-span-6",
				children: /* @__PURE__ */ jsx(AiPanel, {
					phase,
					canScan: !!preview,
					result: scanResult,
					error: scanError,
					onScan: scan,
					onPreviewOffline: previewOfflineDemo
				})
			})]
		})]
	});
}
var sampleShot = "sample";
function Preview({ file, scanning, done, result, onReset, onPick, onCamera }) {
	const [url, setUrl] = useState(null);
	useEffect(() => {
		if (file === sampleShot) {
			setUrl(null);
			return;
		}
		const u = URL.createObjectURL(file);
		setUrl(u);
		return () => URL.revokeObjectURL(u);
	}, [file]);
	return /* @__PURE__ */ jsxs("div", {
		className: "overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "relative aspect-video bg-gradient-to-br from-mint/12 via-surface-2 to-surface-3",
			children: [
				/* @__PURE__ */ jsx("img", {
					src: url ?? SCAN_RESULT.image,
					alt: file === sampleShot ? SCAN_RESULT.imageCaption : "Ảnh bạn đã chọn",
					className: "size-full object-cover"
				}),
				scanning && /* @__PURE__ */ jsx("div", {
					className: "scan-line",
					"aria-hidden": "true"
				}),
				scanning ? /* @__PURE__ */ jsxs("span", {
					className: "absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white",
					children: [/* @__PURE__ */ jsx("span", { className: "pulse-bar size-1.5 rounded-full bg-mint-bright" }), "AI đang phân tích"]
				}) : /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onCamera,
					className: "absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-line-soft bg-white/90 px-3 py-1.5 text-[11px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition hover:bg-white",
					children: [/* @__PURE__ */ jsx(CameraIcon, {}), "Chụp trực tiếp"]
				}),
				!scanning && /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onReset,
					title: "Bỏ ảnh",
					"aria-label": "Bỏ ảnh",
					className: "absolute top-3 left-3 grid size-8 place-items-center rounded-full border border-line-soft bg-white/90 text-warn shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md transition hover:bg-warn hover:text-white",
					children: /* @__PURE__ */ jsx(CloseIcon, {})
				}),
				done && result && /* @__PURE__ */ jsxs("span", {
					className: "absolute bottom-3 left-3 inline-flex items-center gap-2 rounded-full border border-line-soft bg-white/90 px-3.5 py-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] backdrop-blur-md",
					children: [
						/* @__PURE__ */ jsx("i", { className: `size-2 rounded-full ${result.isOod ? "bg-warn" : "bg-brand-deep"}` }),
						/* @__PURE__ */ jsx("b", {
							className: `text-xs font-semibold ${result.isOod ? "text-warn" : "text-brand-deep"}`,
							children: result.isOod ? "Chưa xác định rõ" : result.tag
						}),
						/* @__PURE__ */ jsxs("em", {
							className: "text-[11px] font-medium text-muted not-italic",
							children: [
								"• ",
								result.confidencePct,
								"% độ tin cậy"
							]
						})
					]
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between gap-3 border-t border-surface-2 bg-white px-4 py-2.5",
			children: [/* @__PURE__ */ jsx("span", {
				className: "truncate text-[13px] text-body",
				children: file === sampleShot ? SCAN_RESULT.imageCaption : file.name
			}), /* @__PURE__ */ jsxs("label", {
				className: "btn-outline h-8 shrink-0 cursor-pointer px-3 text-[13px]",
				children: ["Đổi ảnh", /* @__PURE__ */ jsx("input", {
					type: "file",
					accept: ".jpg,.jpeg,.png,.webp,.bmp,image/*",
					className: "sr-only",
					onChange: (e) => onPick(e.target.files?.[0] ?? null)
				})]
			})]
		})]
	});
}
function UploadZone({ onPick, onSample, onCamera }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-sage-line bg-surface px-6 py-10 text-center",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "grid size-14 place-items-center rounded-full bg-brand/10 text-brand",
				children: /* @__PURE__ */ jsxs("svg", {
					viewBox: "0 0 24 24",
					className: "size-7",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: "1.6",
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
					children: [/* @__PURE__ */ jsx("path", { d: "M12 16V4M8 8l4-4 4 4" }), /* @__PURE__ */ jsx("path", { d: "M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" })]
				})
			}),
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
				className: "text-base font-bold text-ink",
				children: "Đưa ảnh vật rác vào để bắt đầu"
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-1.5 text-[13px] leading-5 text-muted",
				children: "Hỗ trợ JPG, PNG, WEBP. Ảnh rõ, nền thoáng giúp AI phân loại và định giá chuẩn xác."
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap justify-center gap-2",
				children: [/* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onCamera,
					className: "btn-primary h-11 px-5",
					children: [/* @__PURE__ */ jsx(CameraIcon, {}), "Chụp ảnh"]
				}), /* @__PURE__ */ jsxs("label", {
					className: "btn-outline h-11 cursor-pointer px-5",
					children: ["Tải ảnh lên", /* @__PURE__ */ jsx("input", {
						type: "file",
						accept: ".jpg,.jpeg,.png,.webp,.bmp,image/*",
						className: "sr-only",
						onChange: (e) => e.target.files?.[0] && onPick(e.target.files[0])
					})]
				})]
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: onSample,
				className: "text-[13px] font-semibold text-brand-deep underline underline-offset-4 hover:text-brand",
				children: "Dùng luôn ảnh mẫu để quét thử AI"
			})
		]
	});
}
function AiPanel({ phase, canScan, result, error, onScan, onPreviewOffline }) {
	const faceMeta = phase === "done" && result?.isOod ? {
		src: AI_IDLE,
		alt: "AI cần góc chụp rõ hơn",
		title: "Độ tin cậy chưa đạt 60%",
		note: "Vật thể lạ hoặc góc chụp mờ, bạn có thể chụp lại hoặc báo nhãn đúng."
	} : FACE[phase];
	return /* @__PURE__ */ jsxs("div", {
		className: "card flex flex-col gap-3 p-5 shadow-[0_1px_1px_rgba(0,0,0,0.05)]",
		children: [
			/* @__PURE__ */ jsx(AiFace, {
				...faceMeta,
				action: /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: onScan,
					disabled: phase === "scanning" || !canScan,
					className: "btn-primary h-10 shrink-0 rounded-xl px-4 text-[13px]",
					children: [/* @__PURE__ */ jsx(SparkIcon, {}), CTA$1[phase]]
				})
			}),
			!canScan && phase === "idle" && !error && /* @__PURE__ */ jsx("p", {
				className: "reveal -mt-1 text-[13px] text-muted",
				style: { animationDelay: `${T.gap}ms` },
				children: "Chọn hoặc chụp một ảnh để bắt đầu quét"
			}),
			error && phase === "idle" && /* @__PURE__ */ jsxs("div", {
				role: "alert",
				className: "reveal rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-[13px] leading-5 text-ink",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "font-semibold text-warn",
						children: ["Không thể hoàn tất quét AI ", error.code ? `(${error.code})` : ""]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1 text-body",
						children: error.message
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-3 flex flex-wrap gap-2",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: onScan,
							className: "btn-primary h-9 px-3.5 text-xs",
							children: "Thử quét lại"
						}), error.canPreviewOffline && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: onPreviewOffline,
							className: "btn-ghost h-9 px-3.5 text-xs",
							children: "Xem kết quả mẫu (Offline)"
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", { children: [
				phase === "idle" && /* @__PURE__ */ jsx("div", {
					className: "reveal mt-2 border-t border-line-soft pt-5",
					style: { animationDelay: `${T.gap}ms` },
					children: /* @__PURE__ */ jsx(HowTo, {})
				}),
				phase === "scanning" && /* @__PURE__ */ jsxs("div", {
					className: "reveal mt-2 space-y-3",
					style: { animationDelay: `${T.gap}ms` },
					children: [
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-7 w-2/5 rounded bg-surface-3" }),
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-3.5 w-4/5 rounded bg-surface-2" }),
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-16 w-full rounded-lg bg-surface-2" }),
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-32 w-full rounded-lg bg-surface-2" })
					]
				}),
				phase === "done" && result && (result.isOod ? /* @__PURE__ */ jsx(OodResult, { result }) : /* @__PURE__ */ jsx(ScanResult, { result }))
			] }, phase)
		]
	});
}
var CTA$1 = {
	idle: "Quét AI",
	scanning: "Đang phân tích",
	done: "Quét lại"
};
var FACE = {
	idle: {
		src: AI_IDLE,
		alt: "AI sẵn sàng nhận diện rác",
		title: "Sẵn sàng quét",
		note: "Đưa ảnh vật rác vào, AI sẽ tìm vật liệu và định giá giúp bạn."
	},
	scanning: {
		src: AI_SCANNING,
		alt: "AI đang phân tích hình ảnh",
		title: "AI đang quét ảnh",
		note: AI_MSG.scanning
	},
	done: {
		src: AI_DONE,
		alt: "AI đã nhận diện xong",
		title: "AI đã nhận diện xong",
		note: "Đã khớp vật liệu với Rule Engine và tính đơn giá tham khảo."
	}
};
function AiFace({ src, alt, title, note, action }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex items-start gap-3",
		children: [
			/* @__PURE__ */ jsx("img", {
				src,
				alt,
				className: "size-11 shrink-0 object-contain",
				loading: "lazy"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "min-w-0 flex-1",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "reveal text-sm leading-5 font-bold text-ink",
					style: { animationDuration: "260ms" },
					children: title
				}, title), note && /* @__PURE__ */ jsx("p", {
					className: "reveal text-[12px] leading-4 text-muted",
					style: { animationDuration: "260ms" },
					children: note
				}, note)]
			}),
			action
		]
	});
}
function ScanResult({ result }) {
	const mapUrl = result.recyclable && isDiscoverableCategory(result.categoryCode) ? `/map?category=${encodeURIComponent(result.categoryCode)}` : "/map";
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "draw-frame block w-full rounded-full border border-mint/40 bg-mint/25 px-3.5 py-1.5 text-center text-[11px] leading-4 font-semibold whitespace-nowrap text-brand-deep",
				style: { animationDelay: `${T.chipFrame}ms` },
				children: /* @__PURE__ */ jsx(Words, {
					text: result.badge,
					from: T.chipWord
				})
			}),
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-[24px] leading-8 font-bold tracking-tight text-ink",
				style: { animationDelay: `${T.title}ms` },
				children: /* @__PURE__ */ jsx(Words, {
					text: result.material,
					from: T.title
				})
			}), /* @__PURE__ */ jsx("p", {
				className: "reveal mt-1 text-[13px] leading-5 text-body",
				style: { animationDelay: `${T.desc}ms` },
				children: result.description
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "reveal flex items-center justify-between rounded-lg border border-line-soft bg-surface-2 px-4 py-3",
				style: { animationDelay: `${T.price}ms` },
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "text-[10px] font-semibold tracking-[0.5px] text-body uppercase",
					children: result.price.label
				}), /* @__PURE__ */ jsxs("p", {
					className: "mt-0.5 flex items-baseline gap-1.5",
					children: [/* @__PURE__ */ jsx("b", {
						className: "text-xl leading-7 font-bold tracking-tight text-brand-deep",
						children: result.price.value
					}), /* @__PURE__ */ jsx("span", {
						className: "text-xs font-semibold text-body",
						children: result.price.unit
					})]
				})] }), /* @__PURE__ */ jsx(PriceIcon, {})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "reveal rounded-lg border border-line-soft bg-surface-2 p-4",
				style: { animationDelay: `${T.conf}ms` },
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ jsxs("p", {
							className: "flex items-center gap-1.5 text-xs font-semibold text-ink",
							children: [/* @__PURE__ */ jsx(ShieldIcon, {}), "Độ tin cậy nhận diện AI"]
						}), /* @__PURE__ */ jsxs("span", {
							className: "rounded-full border border-brand/20 bg-mint/25 px-2.5 py-1 text-[11px] font-semibold text-brand-deep",
							children: [
								"Chính xác ",
								result.confidencePct,
								"%"
							]
						})]
					}),
					/* @__PURE__ */ jsx("ul", {
						className: "mt-3 flex flex-col gap-2.5",
						children: result.breakdown.map((b, i) => /* @__PURE__ */ jsxs("li", { children: [/* @__PURE__ */ jsxs("p", {
							className: "flex items-center justify-between text-[13px]",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "flex items-center gap-1.5 font-semibold text-ink",
								children: [/* @__PURE__ */ jsx("i", {
									className: "size-2 rounded-full",
									style: { background: b.color }
								}), b.label]
							}), /* @__PURE__ */ jsxs("b", {
								className: b.value >= 50 ? "text-brand-deep" : "text-body",
								children: [b.value, "%"]
							})]
						}), /* @__PURE__ */ jsx("div", {
							className: "mt-1 h-1.5 overflow-clip rounded-full bg-line/70",
							children: /* @__PURE__ */ jsx("div", {
								className: "bar-grow h-full rounded-full",
								style: {
									width: `${b.value}%`,
									background: b.color,
									animationDelay: `${T.bar + i * T.barStep}ms`
								}
							})
						})] }, `${b.label}-${i}`))
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-3 flex items-center justify-between gap-2 border-t border-line-soft pt-2.5 text-[11px] text-muted",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-1.5 truncate",
							children: [/* @__PURE__ */ jsx(InfoIcon, {}), result.modelLabel]
						}), result.messageCode && /* @__PURE__ */ jsx("span", {
							className: "shrink-0 font-mono text-[10px] text-muted/80",
							children: result.messageCode
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "reveal flex flex-col gap-2",
				style: { animationDelay: `${T.actions}ms` },
				children: [result.recyclable ? /* @__PURE__ */ jsx(Link, {
					to: mapUrl,
					className: "btn-primary h-11 w-full rounded-xl px-4",
					children: "Tìm cơ sở thu mua loại rác này"
				}) : /* @__PURE__ */ jsx(Link, {
					to: "/guidance",
					className: "btn-outline h-11 w-full rounded-xl px-4",
					children: "Xem hướng dẫn xử lý rác sinh hoạt"
				}), /* @__PURE__ */ jsx(InlineFeedbackReport, {
					predictedLabel: result.categoryCode,
					confidenceScore: result.rawConfidence
				})]
			})
		]
	});
}
/** Hiển thị cảnh báo Out-of-Distribution (MSG-CLS-02) khi độ tin cậy < 60%. */
function OodResult({ result }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "reveal flex flex-col gap-3 pt-1",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-xl border border-warn/30 bg-warn/5 p-4",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "flex items-center justify-between gap-2 text-xs font-semibold text-warn",
						children: [/* @__PURE__ */ jsx("span", { children: "Cảnh báo ngưỡng an toàn AI (MSG-CLS-02)" }), /* @__PURE__ */ jsxs("span", { children: [
							"Độ tin cậy: ",
							result.confidencePct,
							"% (< 60%)"
						] })]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-1.5 text-[13px] leading-5 text-ink",
						children: result.message
					}),
					result.breakdown.length > 0 && /* @__PURE__ */ jsxs("p", {
						className: "mt-2 text-xs text-muted",
						children: [
							"Dự đoán gần nhất: ",
							/* @__PURE__ */ jsx("b", {
								className: "text-ink",
								children: result.breakdown[0].label
							}),
							" (",
							result.breakdown[0].value,
							"%) • ",
							result.modelLabel
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "rounded-xl border border-line-soft bg-surface-2 p-3.5 text-[13px] leading-5 text-body",
				children: [/* @__PURE__ */ jsx("p", {
					className: "font-semibold text-ink",
					children: "Mẹo chụp lại để đạt độ chính xác cao:"
				}), /* @__PURE__ */ jsxs("ul", {
					className: "mt-1.5 list-disc space-y-1 pl-4 text-xs text-body",
					children: [
						/* @__PURE__ */ jsx("li", { children: "Đặt món rác ở giữa khung hình, cách camera khoảng 20–40 cm." }),
						/* @__PURE__ */ jsx("li", { children: "Tránh chụp ngược sáng hoặc để nhiều đồ vật khác lọt vào nền." }),
						/* @__PURE__ */ jsxs("li", { children: [
							"Hoặc thử chuyển sang mô hình ",
							/* @__PURE__ */ jsx("b", { children: "EfficientNet-B0" }),
							" ở góc phải phía trên."
						] })
					]
				})]
			}),
			/* @__PURE__ */ jsx(InlineFeedbackReport, {
				predictedLabel: result.categoryCode,
				confidenceScore: result.rawConfidence,
				defaultOpen: true
			})
		]
	});
}
/** Gửi phản hồi AI nhận diện sai ngay tại màn hình quét (POST /api/v1/waste-scan/feedback). */
function InlineFeedbackReport({ predictedLabel, confidenceScore, defaultOpen = false }) {
	const [open, setOpen] = useState(defaultOpen);
	const [reportedLabel, setReportedLabel] = useState("");
	const [note, setNote] = useState("");
	const [sending, setSending] = useState(false);
	const [doneMsg, setDoneMsg] = useState("");
	const [errMsg, setErrMsg] = useState("");
	const handleSubmit = async () => {
		if (!reportedLabel || sending) return;
		setSending(true);
		setErrMsg("");
		try {
			const res = await submitAiFeedback({
				predictedLabel,
				confidenceScore,
				userReportedLabel: reportedLabel,
				note: note.trim() || void 0
			});
			setDoneMsg(res.message);
		} catch (err) {
			setErrMsg(err instanceof Error ? err.message : "Chưa gửi được phản hồi. Vui lòng thử lại sau.");
		} finally {
			setSending(false);
		}
	};
	if (doneMsg) return /* @__PURE__ */ jsx("p", {
		role: "status",
		className: "rounded-lg border border-brand/25 bg-brand/8 px-3 py-2 text-xs font-medium text-brand-deep",
		children: doneMsg
	});
	if (!open) return /* @__PURE__ */ jsx("button", {
		type: "button",
		onClick: () => setOpen(true),
		className: "self-center text-xs font-medium text-muted underline underline-offset-4 hover:text-brand-deep",
		children: "AI nhận diện chưa đúng? Báo nhãn đúng tại đây"
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "rounded-xl border border-line bg-surface p-3 text-xs",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between gap-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "font-semibold text-ink",
					children: "Báo cáo nhãn rác đúng (cải thiện AI)"
				}), !defaultOpen && /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setOpen(false),
					className: "text-muted hover:text-ink",
					children: "Đóng"
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2 grid gap-2 sm:grid-cols-2",
				children: [/* @__PURE__ */ jsxs("select", {
					"aria-label": "Chọn loại rác đúng",
					value: reportedLabel,
					onChange: (e) => setReportedLabel(e.target.value),
					className: "h-9 rounded-lg border border-sage-line bg-white px-2.5 text-xs text-ink focus:border-brand focus:outline-none",
					children: [/* @__PURE__ */ jsx("option", {
						value: "",
						children: "-- Chọn loại rác đúng --"
					}), AI_CLASS_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
						value: opt.code,
						children: opt.label
					}, opt.code))]
				}), /* @__PURE__ */ jsx("input", {
					type: "text",
					value: note,
					onChange: (e) => setNote(e.target.value),
					placeholder: "Ghi chú thêm (tuỳ chọn)",
					className: "h-9 rounded-lg border border-sage-line bg-white px-2.5 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
				})]
			}),
			errMsg && /* @__PURE__ */ jsx("p", {
				className: "mt-1.5 text-warn",
				children: errMsg
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				disabled: !reportedLabel || sending,
				onClick: handleSubmit,
				className: "btn-outline mt-2 h-8 px-3 text-xs disabled:opacity-50",
				children: sending ? "Đang gửi..." : "Gửi phản hồi"
			})
		]
	});
}
function HowTo() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-4",
		children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
			className: "text-lg leading-7 font-bold tracking-tight text-ink",
			children: "Dùng trang này thế nào"
		}), /* @__PURE__ */ jsx("p", {
			className: "mt-1 text-[13px] leading-5 text-muted",
			children: "Ba bước, chưa đến một phút là có đơn giá tham khảo và điểm thu mua."
		})] }), /* @__PURE__ */ jsx("ol", {
			className: "flex flex-col gap-3",
			children: HOW_TO.map((s, i) => /* @__PURE__ */ jsxs("li", {
				className: "flex gap-3",
				children: [/* @__PURE__ */ jsx("span", {
					className: "grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white",
					children: i + 1
				}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "text-sm leading-5 font-semibold text-ink",
					children: s.title
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-0.5 text-[13px] leading-5 text-body",
					children: s.desc
				})] })]
			}, s.title))
		})]
	});
}
function Words({ text, from, step = 70 }) {
	const words = text.split(" ");
	return /* @__PURE__ */ jsx(Fragment, { children: words.map((w, i) => /* @__PURE__ */ jsxs("span", { children: [i > 0 && " ", /* @__PURE__ */ jsx("span", {
		className: "resolve inline-block",
		style: { animationDelay: `${from + i * step}ms` },
		children: w
	})] }, i)) });
}
var T = {
	gap: 320,
	chipFrame: 340,
	chipWord: 480,
	title: 700,
	desc: 860,
	price: 960,
	conf: 1060,
	bar: 1160,
	barStep: 110,
	actions: 1440
};
function CameraPanel({ onShoot, onClose }) {
	const video = useRef(null);
	const [err, setErr] = useState("");
	const [ready, setReady] = useState(false);
	useEffect(() => {
		let stream;
		let alive = true;
		if (!navigator.mediaDevices?.getUserMedia) {
			setErr("Trình duyệt này không mở được camera. Bạn dùng nút tải ảnh lên được.");
			return;
		}
		navigator.mediaDevices.getUserMedia({
			video: {
				facingMode: { ideal: "environment" },
				width: { ideal: 1280 },
				height: { ideal: 720 }
			},
			audio: false
		}).then((s) => {
			if (!alive) {
				s.getTracks().forEach((t) => t.stop());
				return;
			}
			stream = s;
			if (video.current) {
				video.current.srcObject = s;
				video.current.play();
				setReady(true);
			}
		}).catch((e) => {
			if (!alive) return;
			setErr(e.name === "NotAllowedError" || e.name === "SecurityError" ? "Bạn chưa cấp quyền dùng camera. Cho phép trong cài đặt trình duyệt rồi thử lại, hoặc dùng nút tải ảnh lên." : e.name === "NotFoundError" || e.name === "OverconstrainedError" ? "Máy này không có camera. Bạn dùng nút tải ảnh lên được." : "Không mở được camera. Bạn dùng nút tải ảnh lên được.");
		});
		return () => {
			alive = false;
			stream?.getTracks().forEach((t) => t.stop());
		};
	}, []);
	const shoot = () => {
		const v = video.current;
		if (!v || !v.videoWidth) return;
		const c = document.createElement("canvas");
		c.width = v.videoWidth;
		c.height = v.videoHeight;
		c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
		c.toBlob((blob) => {
			if (blob) onShoot(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
		}, "image/jpeg", .9);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "overflow-clip rounded-2xl border border-line/70 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]",
		children: [/* @__PURE__ */ jsx("div", {
			className: "relative aspect-video bg-ink",
			children: err ? /* @__PURE__ */ jsx("div", {
				className: "grid h-full place-items-center px-6 text-center",
				children: /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "text-sm font-semibold text-white",
					children: "Không mở được camera"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1.5 text-[13px] leading-5 text-white/70",
					children: err
				})] })
			}) : /* @__PURE__ */ jsxs(Fragment, { children: [
				/* @__PURE__ */ jsx("video", {
					ref: video,
					playsInline: true,
					muted: true,
					className: "size-full object-cover",
					"aria-label": "Khung hình camera"
				}),
				!ready && /* @__PURE__ */ jsx("p", {
					className: "absolute inset-0 grid place-items-center text-[13px] text-white/70",
					children: "Đang bật camera..."
				}),
				/* @__PURE__ */ jsxs("span", {
					className: "absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-ink/85 px-3 py-1.5 text-[11px] font-semibold text-white",
					children: [/* @__PURE__ */ jsx("i", { className: "pulse-bar size-1.5 rounded-full bg-mint-bright" }), "Camera đang mở"]
				})
			] })
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between gap-3 border-t border-surface-2 px-4 py-2.5",
			children: [/* @__PURE__ */ jsx("p", {
				className: "text-[13px] text-muted",
				children: err ? "Hoặc đóng rồi dùng nút tải ảnh lên" : "Đưa vật rác vào khung rồi chụp"
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex shrink-0 gap-2",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onClose,
					className: "btn-ghost h-9 px-4 text-[13px]",
					children: "Huỷ"
				}), /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: shoot,
					disabled: !!err || !ready,
					className: "btn-primary h-9 px-4 text-[13px]",
					children: "Chụp"
				})]
			})]
		})]
	});
}
function Separator() {
	return /* @__PURE__ */ jsx("svg", {
		width: "6",
		height: "10",
		viewBox: "0 0 6 10",
		fill: "none",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("path", {
			d: "M1 1l4 4-4 4",
			stroke: "currentColor",
			strokeWidth: "1.2",
			strokeLinecap: "round"
		})
	});
}
var stroke$2 = {
	stroke: "currentColor",
	strokeWidth: 1.6,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function CameraIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "13",
		height: "13",
		viewBox: "0 0 16 16",
		fill: "none",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M2 5.5A1.5 1.5 0 013.5 4h1L5.5 2.5h5L11.5 4h1A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-7z",
			...stroke$2
		}), /* @__PURE__ */ jsx("circle", {
			cx: "8",
			cy: "9",
			r: "2.4",
			...stroke$2
		})]
	});
}
function PriceIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "24",
		height: "18",
		viewBox: "0 0 26 19",
		fill: "none",
		"aria-hidden": "true",
		className: "text-brand-deep",
		children: [
			/* @__PURE__ */ jsx("rect", {
				x: "1",
				y: "1",
				width: "24",
				height: "17",
				rx: "3",
				...stroke$2
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "13",
				cy: "9.5",
				r: "3.2",
				...stroke$2
			}),
			/* @__PURE__ */ jsx("path", {
				d: "M4.5 5.5h3M4.5 13.5h3",
				...stroke$2
			})
		]
	});
}
function ShieldIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "13",
		height: "14",
		viewBox: "0 0 14 15",
		fill: "none",
		"aria-hidden": "true",
		className: "text-brand-deep",
		children: /* @__PURE__ */ jsx("path", {
			d: "M7 1l5 2v4c0 3.2-2.1 5.8-5 7-2.9-1.2-5-3.8-5-7V3l5-2z",
			...stroke$2
		})
	});
}
function InfoIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "12",
		height: "12",
		viewBox: "0 0 14 14",
		fill: "none",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "7",
			cy: "7",
			r: "6",
			...stroke$2
		}), /* @__PURE__ */ jsx("path", {
			d: "M7 6.2v3.4M7 4.4v.6",
			...stroke$2
		})]
	});
}
function CloseIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "2.2",
		strokeLinecap: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("path", { d: "M6 6l12 12M18 6 6 18" })
	});
}
function SparkIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "16",
		height: "16",
		viewBox: "0 0 24 24",
		fill: "none",
		stroke: "currentColor",
		strokeWidth: "1.8",
		strokeLinecap: "round",
		strokeLinejoin: "round",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("path", { d: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" })
	});
}
//#endregion
//#region src/pages/MapPage.tsx
/** Dữ liệu dự phòng chỉ dùng khi máy chủ Backend chưa được bật để người xem giao diện
*  vẫn kiểm tra được luồng chọn pin, xem bảng giá và chuyển sang đặt lịch bàn giao. */
var OFFLINE_PARTNERS = [{
	id: "22222222-2222-2222-2222-222222222222",
	facilityName: "Vựa phế liệu EcoGreen",
	representativeName: "Trần Thu Gom",
	address: "123 Đường Nguyễn Hữu Cảnh, P. 22, Bình Thạnh, TP.HCM",
	latitude: 10.7938,
	longitude: 106.7182,
	distanceKm: 2.54,
	contactPhone: "0988776655",
	operatingHours: "07:30 - 18:30",
	description: "Chuyên thu mua nhựa sạch, bìa carton và vỏ lon nhôm tận nơi.",
	materials: [
		{
			categoryCode: "plastic",
			categoryName: "Nhựa tái chế (Plastic)",
			pricePerKg: 7e3,
			minimumQuantityKg: 1,
			collectionConditions: "Chai nhựa PET/HDPE đã tráng sạch, bẹp chai"
		},
		{
			categoryCode: "paper",
			categoryName: "Giấy báo & Tài liệu (Paper)",
			pricePerKg: 4500,
			minimumQuantityKg: 2,
			collectionConditions: "Giấy báo, tài liệu khô ráo, không dính dầu mỡ"
		},
		{
			categoryCode: "metal",
			categoryName: "Kim loại & Vỏ lon (Metal)",
			pricePerKg: 25e3,
			minimumQuantityKg: .5,
			collectionConditions: "Vỏ lon nhôm, sắt vụn đã dốc sạch nước"
		},
		{
			categoryCode: "cardboard",
			categoryName: "Bìa Carton (Cardboard)",
			pricePerKg: 3800,
			minimumQuantityKg: 3,
			collectionConditions: "Thùng carton gập phẳng, khô ráo"
		}
	]
}, {
	id: "11111111-1111-1111-1111-111111111111",
	facilityName: "Vựa Phế Liệu Xanh Quận 1",
	representativeName: "Nguyễn Văn Minh",
	address: "123 Nguyễn Thị Minh Khai, P. Bến Thành, Quận 1, TP.HCM",
	latitude: 10.7725,
	longitude: 106.692,
	distanceKm: 1.18,
	contactPhone: "0901234567",
	operatingHours: "08:00 - 18:00",
	materials: [{
		categoryCode: "plastic",
		categoryName: "Nhựa tái chế (Plastic)",
		pricePerKg: 6800,
		minimumQuantityKg: 1.5,
		collectionConditions: "Bóc nhãn rời nếu có"
	}, {
		categoryCode: "glass",
		categoryName: "Chai lọ thủy tinh",
		pricePerKg: 2e3,
		minimumQuantityKg: 5,
		collectionConditions: "Không lẫn mảnh kính cường lực"
	}]
}];
/** U-05 Tìm kiếm cơ sở thu gom theo vị trí địa lý GPS (Location-Based Recycler Discovery).
*
*  Kết nối trực tiếp với:
*   - `GET /api/v1/recyclers/nearby` (lọc theo toạ độ GPS, bán kính, loại rác từ AI, từ khoá, giá)
*   - `GET /api/v1/recyclers/{recyclerId}` (xem hồ sơ công khai & bảng giá Active từ Module R-01/R-02)
*   - Hiển thị phương án dự phòng 3 tầng `FallbackSuggestion` (`MSG-MTH-01`) khi bán kính không có người mua. */
function MapPage() {
	const [searchParams, setSearchParams] = useSearchParams();
	const initialCatParam = searchParams.get("category");
	const initialCat = isDiscoverableCategory(initialCatParam) ? initialCatParam.trim().toLowerCase() : "";
	const [coords, setCoords] = useState({
		lat: LOCATION_PRESETS[0].lat,
		lng: LOCATION_PRESETS[0].lng,
		label: LOCATION_PRESETS[0].address,
		source: "preset"
	});
	const [showLocationPicker, setShowLocationPicker] = useState(false);
	const [gpsStatusMsg, setGpsStatusMsg] = useState("");
	const [locatingGps, setLocatingGps] = useState(false);
	const [category, setCategory] = useState(initialCat);
	const [radiusKm, setRadiusKm] = useState(10);
	const [keyword, setKeyword] = useState("");
	const [debouncedKeyword, setDebouncedKeyword] = useState("");
	const [sortBy, setSortBy] = useState("distance");
	const [loading, setLoading] = useState(false);
	const [isOfflineDemo, setIsOfflineDemo] = useState(false);
	const [errorMsg, setErrorMsg] = useState("");
	const [partners, setPartners] = useState([]);
	const [fallback, setFallback] = useState(null);
	const [selectedId, setSelectedId] = useState(null);
	const [selectedDetail, setSelectedDetail] = useState(null);
	const [loadingDetail, setLoadingDetail] = useState(false);
	useEffect(() => {
		const p = searchParams.get("category");
		const next = isDiscoverableCategory(p) ? p.trim().toLowerCase() : "";
		setCategory(next);
	}, [searchParams]);
	useEffect(() => {
		const t = setTimeout(() => setDebouncedKeyword(keyword.trim()), 280);
		return () => clearTimeout(t);
	}, [keyword]);
	const requestBrowserGps = () => {
		if (typeof navigator === "undefined" || !navigator.geolocation) {
			setGpsStatusMsg("Trình duyệt không hỗ trợ định vị GPS (MSG-MTH-02). Đang dùng vị trí khu vực đã chọn.");
			return;
		}
		setLocatingGps(true);
		setGpsStatusMsg("");
		navigator.geolocation.getCurrentPosition((pos) => {
			const lat = Number(pos.coords.latitude.toFixed(6));
			const lng = Number(pos.coords.longitude.toFixed(6));
			setCoords({
				lat,
				lng,
				label: `Vị trí GPS của bạn (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
				source: "gps"
			});
			setLocatingGps(false);
			setShowLocationPicker(false);
		}, () => {
			setLocatingGps(false);
			setGpsStatusMsg("Cần quyền truy cập vị trí để tự động định vị (MSG-MTH-02). Bạn vẫn có thể chọn nhanh quận/khu vực bên cạnh.");
		}, {
			enableHighAccuracy: true,
			timeout: 7e3,
			maximumAge: 6e4
		});
	};
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setErrorMsg("");
		searchNearbyRecyclers({
			lat: coords.lat,
			lng: coords.lng,
			category,
			radiusKm,
			keyword: debouncedKeyword,
			sortBy: category ? sortBy : "distance"
		}, controller.signal).then((res) => {
			if (controller.signal.aborted) return;
			setIsOfflineDemo(false);
			const list = res.data.items ?? [];
			setPartners(list);
			setFallback(list.length === 0 ? res.data.fallbackSuggestion ?? null : null);
			setSelectedId((prev) => prev && list.some((item) => item.id === prev) ? prev : list[0]?.id ?? null);
		}).catch((err) => {
			if (controller.signal.aborted || err?.name === "AbortError") return;
			if (err instanceof ApiError && err.isNetworkError) {
				setIsOfflineDemo(true);
				const filteredOffline = OFFLINE_PARTNERS.filter((p) => {
					const hitCat = !category || p.materials.some((m) => m.categoryCode.toLowerCase() === category);
					const kw = debouncedKeyword.toLowerCase();
					const hitKw = !kw || p.facilityName.toLowerCase().includes(kw) || p.address.toLowerCase().includes(kw);
					return hitCat && hitKw;
				});
				setPartners(filteredOffline);
				setFallback(filteredOffline.length === 0 ? {
					suggestedExpandedRadiusKm: Math.min(50, Math.round(radiusKm * 2.5)),
					guidanceMessage: "Không tìm thấy cơ sở thu mua phù hợp trong bộ lọc hiện tại.",
					allowCommunityPickupPost: true
				} : null);
				setSelectedId(filteredOffline[0]?.id ?? null);
				return;
			}
			setErrorMsg(err instanceof Error ? err.message : "Không thể tải danh sách cơ sở thu mua gần bạn.");
			setPartners([]);
			setFallback(null);
		}).finally(() => {
			if (!controller.signal.aborted) setLoading(false);
		});
		return () => controller.abort();
	}, [
		coords.lat,
		coords.lng,
		category,
		radiusKm,
		debouncedKeyword,
		sortBy
	]);
	useEffect(() => {
		if (!selectedId) {
			setSelectedDetail(null);
			return;
		}
		const baseItem = partners.find((p) => p.id === selectedId) ?? null;
		setSelectedDetail(baseItem);
		if (isOfflineDemo) return;
		const controller = new AbortController();
		setLoadingDetail(true);
		getRecyclerPublicDetail(selectedId, coords.lat, coords.lng, controller.signal).then((detail) => {
			if (!controller.signal.aborted) setSelectedDetail(detail);
		}).catch(() => {}).finally(() => {
			if (!controller.signal.aborted) setLoadingDetail(false);
		});
		return () => controller.abort();
	}, [
		selectedId,
		coords.lat,
		coords.lng,
		isOfflineDemo,
		partners
	]);
	const changeCategory = (next) => {
		setCategory(next);
		const nextParams = new URLSearchParams(searchParams);
		if (next) nextParams.set("category", next);
		else nextParams.delete("category");
		setSearchParams(nextParams, { replace: true });
	};
	const radiusChoices = useMemo(() => {
		const base = [...RADIUS_OPTIONS];
		if (!base.includes(radiusKm)) {
			base.push(radiusKm);
			base.sort((a, b) => a - b);
		}
		return base;
	}, [radiusKm]);
	const activePartner = selectedDetail ?? partners.find((p) => p.id === selectedId) ?? null;
	const handoverUrl = useMemo(() => {
		if (!activePartner) return "/user/handover";
		const p = new URLSearchParams();
		p.set("partnerId", activePartner.id);
		p.set("partnerName", activePartner.facilityName);
		if (category) p.set("waste", getCategoryMeta(category).handoverWasteId);
		return `/user/handover?${p.toString()}`;
	}, [activePartner, category]);
	const chatUrl = useMemo(() => {
		if (!activePartner) return "/chat";
		const p = new URLSearchParams();
		p.set("partnerId", activePartner.id);
		p.set("partnerName", activePartner.facilityName);
		p.set("partnerAddress", activePartner.address);
		return `/chat?${p.toString()}`;
	}, [activePartner]);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-4 p-4 xl:h-[calc(100dvh-76px)] xl:flex-row",
		children: [/* @__PURE__ */ jsx("section", {
			className: "relative flex min-h-[480px] flex-1 flex-col overflow-clip rounded-2xl border border-line bg-surface-3",
			children: /* @__PURE__ */ jsxs("div", {
				className: "relative flex-1",
				children: [
					/* @__PURE__ */ jsx("img", {
						src: "/assets/map/078b8.png",
						alt: "Bản đồ khu vực cơ sở thu mua phế liệu",
						className: "absolute inset-0 size-full object-cover"
					}),
					/* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-white/35 via-white/5 to-white/25" }),
					/* @__PURE__ */ jsx("div", {
						"aria-hidden": "true",
						className: "pointer-events-none absolute top-1/2 left-1/2 size-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-brand/35 bg-brand/5 md:size-88"
					}),
					/* @__PURE__ */ jsx("div", {
						className: "absolute top-1/2 left-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center",
						children: /* @__PURE__ */ jsxs("span", {
							className: "flex items-center gap-1.5 rounded-full border border-brand/30 bg-white px-3 py-1 text-[11px] font-semibold text-ink shadow-[0_4px_10px_rgba(0,0,0,0.12)]",
							children: [/* @__PURE__ */ jsx("span", { className: "size-2 rounded-full bg-brand" }), "Bạn ở đây"]
						})
					}),
					partners.map((partner, idx) => {
						const pos = projectPartnerPinPosition(coords.lat, coords.lng, partner.latitude, partner.longitude, radiusKm, idx);
						const isSelected = partner.id === activePartner?.id;
						return /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setSelectedId(partner.id),
							style: pos,
							className: `absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform focus:outline-none ${isSelected ? "z-20 scale-105" : "z-10 hover:scale-105"}`,
							children: isSelected ? /* @__PURE__ */ jsx(ActivePin, { label: `${partner.facilityName} (${formatDistance(partner.distanceKm)})` }) : /* @__PURE__ */ jsx(SimplePin, { label: `${partner.facilityName} (${formatDistance(partner.distanceKm)})` })
						}, partner.id);
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "absolute inset-x-3.5 top-3.5 z-30 flex flex-col gap-2",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-line bg-white/95 px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md",
									children: [
										/* @__PURE__ */ jsx(PinIcon, {}),
										/* @__PURE__ */ jsxs("div", {
											className: "min-w-0 flex-1",
											children: [/* @__PURE__ */ jsx("p", {
												className: "truncate text-xs font-semibold text-ink",
												children: coords.label
											}), /* @__PURE__ */ jsxs("p", {
												className: "text-[11px] text-muted",
												children: [
													coords.source === "gps" ? "Định vị GPS trực tiếp" : "Toạ độ khu vực",
													" •",
													" ",
													coords.lat.toFixed(4),
													", ",
													coords.lng.toFixed(4)
												]
											})]
										}),
										/* @__PURE__ */ jsx("button", {
											type: "button",
											onClick: () => setShowLocationPicker((v) => !v),
											className: "shrink-0 rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-deep hover:bg-surface-3",
											children: showLocationPicker ? "Đóng" : "Đổi vị trí"
										})
									]
								}), /* @__PURE__ */ jsx("div", {
									role: "group",
									"aria-label": "Bán kính tìm kiếm",
									className: "flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white/95 p-1.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] backdrop-blur-md",
									children: radiusChoices.map((r) => /* @__PURE__ */ jsxs("button", {
										type: "button",
										onClick: () => setRadiusKm(r),
										className: `rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${radiusKm === r ? "bg-brand-deep text-white" : "text-ink hover:bg-surface-2"}`,
										children: [r, " km"]
									}, r))
								})]
							}),
							showLocationPicker && /* @__PURE__ */ jsxs("div", {
								className: "rounded-xl border border-line bg-white/98 p-3 shadow-lg backdrop-blur-md",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "flex flex-wrap items-center justify-between gap-2 pb-2",
									children: [/* @__PURE__ */ jsx("span", {
										className: "text-xs font-semibold text-ink",
										children: "Chọn vị trí tìm kiếm (bảo mật vị trí theo BR-MTH-05)"
									}), /* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: requestBrowserGps,
										disabled: locatingGps,
										className: "btn-primary h-8 px-3 text-xs",
										children: locatingGps ? "Đang lấy GPS..." : "Dùng GPS hiện tại"
									})]
								}), /* @__PURE__ */ jsx("div", {
									className: "grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3",
									children: LOCATION_PRESETS.map((preset) => {
										const active = Math.abs(coords.lat - preset.lat) < .001 && Math.abs(coords.lng - preset.lng) < .001;
										return /* @__PURE__ */ jsxs("button", {
											type: "button",
											onClick: () => {
												setCoords({
													lat: preset.lat,
													lng: preset.lng,
													label: preset.address,
													source: "preset"
												});
												setGpsStatusMsg("");
												setShowLocationPicker(false);
											},
											className: `rounded-lg border px-3 py-2 text-left text-xs transition-colors ${active ? "border-brand bg-brand/10 font-semibold text-brand-deep" : "border-line-soft bg-surface hover:bg-surface-2 text-ink"}`,
											children: [/* @__PURE__ */ jsx("span", {
												className: "block font-semibold",
												children: preset.label
											}), /* @__PURE__ */ jsx("span", {
												className: "block truncate text-[11px] text-muted",
												children: preset.address
											})]
										}, preset.id);
									})
								})]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "flex flex-wrap items-center gap-1.5",
								children: DISCOVERY_CATEGORIES.map((c) => {
									const on = category === c.value;
									return /* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => changeCategory(c.value),
										className: `rounded-full border px-3 py-1 text-[11px] font-semibold shadow-2xs backdrop-blur-md transition-colors ${on ? "border-brand-deep bg-brand-deep text-white" : "border-line bg-white/92 text-ink hover:bg-white"}`,
										children: c.label
									}, c.value || "all");
								})
							}),
							gpsStatusMsg && /* @__PURE__ */ jsx("p", {
								role: "status",
								className: "rounded-xl border border-warn/30 bg-white/95 px-3 py-2 text-xs text-warn shadow-xs",
								children: gpsStatusMsg
							})
						]
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: requestBrowserGps,
						disabled: locatingGps,
						title: "Lấy vị trí GPS hiện tại",
						"aria-label": "Về lại vị trí hiện tại",
						className: "absolute right-3.5 bottom-3.5 z-20 grid size-10 place-items-center rounded-xl border border-line bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition hover:bg-white disabled:opacity-60",
						children: /* @__PURE__ */ jsx(CrosshairIcon, {})
					})
				]
			})
		}), /* @__PURE__ */ jsxs("section", {
			className: "flex min-h-[580px] w-full shrink-0 flex-col overflow-clip rounded-2xl border border-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] xl:h-full xl:w-[480px]",
			children: [/* @__PURE__ */ jsxs("header", {
				className: "flex shrink-0 flex-col gap-3 border-b border-line px-5 py-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-start justify-between gap-2",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h1", {
						className: "text-lg leading-6 font-bold text-ink",
						children: "Cơ sở thu mua gần bạn"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-xs text-muted",
						children: "Chỉ hiển thị cơ sở đã xác minh (Verified) và đang mở cửa nhận đơn"
					})] }), /* @__PURE__ */ jsxs("span", {
						className: `chip shrink-0 ${isOfflineDemo ? "bg-warn/10 text-warn" : "bg-surface-2 text-brand-deep"}`,
						children: [/* @__PURE__ */ jsx("i", { className: `size-1.5 rounded-full ${isOfflineDemo ? "bg-warn" : "bg-brand"}` }), loading ? "Đang tìm..." : isOfflineDemo ? `${partners.length} mẫu Offline` : `${partners.length} mở cửa`]
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex gap-2",
					children: [/* @__PURE__ */ jsx("input", {
						type: "search",
						value: keyword,
						onChange: (e) => setKeyword(e.target.value),
						placeholder: "Tìm tên cơ sở hoặc đường, quận...",
						"aria-label": "Tìm tên cơ sở hoặc địa chỉ",
						className: "h-9 min-w-0 flex-1 rounded-lg border border-sage-line bg-surface px-3 text-xs text-ink placeholder:text-muted focus:border-brand focus:outline-none"
					}), /* @__PURE__ */ jsxs("select", {
						"aria-label": "Sắp xếp kết quả",
						value: category ? sortBy : "distance",
						disabled: !category,
						onChange: (e) => setSortBy(e.target.value),
						title: category ? "Chọn tiêu chí sắp xếp" : "Chọn một loại phế liệu cụ thể để sắp xếp theo đơn giá",
						className: "h-9 shrink-0 rounded-lg border border-sage-line bg-surface px-2.5 text-xs font-medium text-ink focus:border-brand focus:outline-none disabled:opacity-60",
						children: [/* @__PURE__ */ jsx("option", {
							value: "distance",
							children: "Gần nhất"
						}), /* @__PURE__ */ jsx("option", {
							value: "price_desc",
							children: "Giá cao nhất"
						})]
					})]
				})]
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex flex-1 flex-col gap-3 overflow-y-auto p-4",
				children: [errorMsg && /* @__PURE__ */ jsx("div", {
					role: "alert",
					className: "rounded-xl border border-warn/30 bg-warn/5 p-3.5 text-xs leading-5 text-warn",
					children: errorMsg
				}), loading ? /* @__PURE__ */ jsxs("div", {
					className: "space-y-3",
					children: [
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-20 rounded-xl bg-surface-2" }),
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-20 rounded-xl bg-surface-2" }),
						/* @__PURE__ */ jsx("div", { className: "pulse-bar h-44 rounded-xl bg-surface-2" })
					]
				}) : partners.length === 0 ? /* @__PURE__ */ jsx(FallbackPanel, {
					radiusKm,
					category,
					fallback,
					onExpandRadius: (nextRadius) => setRadiusKm(nextRadius),
					onClearFilters: () => {
						setKeyword("");
						changeCategory("");
					}
				}) : /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("div", {
					className: "flex flex-col gap-2",
					children: partners.map((p) => {
						const isSelected = p.id === activePartner?.id;
						const matchedMat = category ? p.materials.find((m) => m.categoryCode.toLowerCase() === category) : p.materials[0];
						return /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: () => setSelectedId(p.id),
							className: `w-full rounded-xl border p-3 text-left transition-colors ${isSelected ? "border-brand bg-brand/6 shadow-[0_1px_2px_rgba(0,0,0,0.04)]" : "border-line bg-surface hover:bg-surface-2"}`,
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ jsxs("p", {
										className: "flex items-center gap-1.5 text-sm font-bold text-ink",
										children: [/* @__PURE__ */ jsx("span", {
											className: "truncate",
											children: p.facilityName
										}), /* @__PURE__ */ jsx(VerifiedIcon, {})]
									}), /* @__PURE__ */ jsx("p", {
										className: "mt-0.5 truncate text-xs text-muted",
										children: p.address
									})]
								}), /* @__PURE__ */ jsx("span", {
									className: "shrink-0 rounded-full bg-surface-3 px-2.5 py-0.5 text-[11px] font-semibold text-brand-deep",
									children: formatDistance(p.distanceKm)
								})]
							}), /* @__PURE__ */ jsxs("div", {
								className: "mt-2 flex flex-wrap items-center justify-between gap-2 text-xs",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "text-muted",
									children: ["Giờ mở cửa: ", /* @__PURE__ */ jsx("b", {
										className: "text-body",
										children: p.operatingHours || "08:00 - 18:00"
									})]
								}), matchedMat && /* @__PURE__ */ jsxs("span", {
									className: "font-semibold text-brand-deep",
									children: [
										matchedMat.categoryName.replace(/\s*\(.*\)/, ""),
										":",
										" ",
										formatVnd(matchedMat.pricePerKg),
										"/kg"
									]
								})]
							})]
						}, p.id);
					})
				}), activePartner && /* @__PURE__ */ jsx(PartnerDetailCard, {
					partner: activePartner,
					highlightedCategory: category,
					loadingDetail,
					handoverUrl,
					chatUrl
				})] })]
			})]
		})]
	});
}
function PartnerDetailCard({ partner, highlightedCategory, loadingDetail, handoverUrl, chatUrl }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-1 flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/65 p-4",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ jsx("h2", {
								className: "truncate text-base font-bold text-ink",
								children: partner.facilityName
							}), /* @__PURE__ */ jsx(VerifiedIcon, {})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-0.5 text-xs text-body",
							children: partner.address
						}),
						partner.representativeName && /* @__PURE__ */ jsxs("p", {
							className: "mt-0.5 text-[11px] text-muted",
							children: ["Đại diện: ", partner.representativeName]
						})
					]
				}), partner.contactPhone && /* @__PURE__ */ jsxs("a", {
					href: `tel:${partner.contactPhone}`,
					title: `Gọi ${partner.contactPhone}`,
					className: "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-ink hover:bg-surface-2",
					children: [/* @__PURE__ */ jsx(PhoneIcon, {}), partner.contactPhone]
				})]
			}),
			partner.description && /* @__PURE__ */ jsx("p", {
				className: "text-xs leading-5 text-body",
				children: partner.description
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2 text-xs",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-line-soft bg-white px-3 py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "block text-[11px] text-muted",
						children: "Khoảng cách ước tính"
					}), /* @__PURE__ */ jsxs("b", {
						className: "text-ink",
						children: ["Cách bạn ", formatDistance(partner.distanceKm)]
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "rounded-lg border border-line-soft bg-white px-3 py-2",
					children: [/* @__PURE__ */ jsx("span", {
						className: "block text-[11px] text-muted",
						children: "Khung giờ hoạt động"
					}), /* @__PURE__ */ jsx("b", {
						className: "text-ink",
						children: partner.operatingHours || "08:00 - 18:00"
					})]
				})]
			}),
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ jsx("h3", {
					className: "text-xs font-bold tracking-wide text-ink uppercase",
					children: "Bảng giá thu mua đang áp dụng"
				}), loadingDetail && /* @__PURE__ */ jsx("span", {
					className: "text-[11px] text-muted",
					children: "Đang cập nhật giá..."
				})]
			}), /* @__PURE__ */ jsx("ul", {
				className: "mt-2 flex flex-col gap-1.5",
				children: partner.materials.map((m) => {
					const isHighlighted = highlightedCategory !== "" && m.categoryCode.toLowerCase() === highlightedCategory;
					return /* @__PURE__ */ jsxs("li", {
						className: `rounded-lg border px-3 py-2 text-xs ${isHighlighted ? "border-brand bg-mint/18" : "border-line-soft bg-white"}`,
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between gap-2",
							children: [/* @__PURE__ */ jsx("span", {
								className: "font-semibold text-ink",
								children: m.categoryName
							}), /* @__PURE__ */ jsxs("b", {
								className: "tabular-nums text-brand-deep",
								children: [formatVnd(m.pricePerKg), " / kg"]
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "mt-0.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted",
							children: [/* @__PURE__ */ jsxs("span", { children: [
								"Tối thiểu: ",
								m.minimumQuantityKg,
								" kg"
							] }), m.collectionConditions && /* @__PURE__ */ jsx("span", {
								className: "truncate",
								children: m.collectionConditions
							})]
						})]
					}, m.categoryCode);
				})
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "grid grid-cols-2 gap-2 pt-1",
				children: [/* @__PURE__ */ jsx(Link, {
					to: handoverUrl,
					className: "btn-primary h-10 rounded-xl px-3 text-xs",
					children: "Đặt lịch bàn giao"
				}), /* @__PURE__ */ jsx(Link, {
					to: chatUrl,
					className: "btn-outline h-10 rounded-xl px-3 text-xs",
					children: "Nhắn thương lượng"
				})]
			})
		]
	});
}
function FallbackPanel({ radiusKm, category, fallback, onExpandRadius, onClearFilters }) {
	const expanded = fallback?.suggestedExpandedRadiusKm && fallback.suggestedExpandedRadiusKm > radiusKm ? fallback.suggestedExpandedRadiusKm : Math.min(50, Math.round(radiusKm * 2.5));
	const guide = fallback?.publicBinSortingGuide;
	const prepSteps = parsePreparationSteps(guide?.preparationSteps);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-3 rounded-2xl border border-line bg-surface-2/70 p-4",
		children: [
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("span", {
				className: "inline-block rounded-full bg-warn/12 px-2.5 py-0.5 text-[11px] font-semibold text-warn",
				children: [
					"MSG-MTH-01 • Chưa có cơ sở mở cửa trong ",
					radiusKm,
					" km"
				]
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-2 text-sm leading-6 text-ink",
				children: fallback?.guidanceMessage || "Không tìm thấy cơ sở thu mua rác gần bạn trong bán kính hiện tại. Bạn có thể mở rộng bán kính tìm kiếm hoặc xem hướng dẫn xử lý bên dưới."
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap gap-2",
				children: [radiusKm < 50 && /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => onExpandRadius(expanded),
					className: "btn-primary h-9 px-3.5 text-xs",
					children: [
						"Mở rộng bán kính lên ",
						expanded,
						" km"
					]
				}), category && /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: onClearFilters,
					className: "btn-ghost h-9 px-3.5 text-xs",
					children: "Xem tất cả loại phế liệu"
				})]
			}),
			guide && /* @__PURE__ */ jsxs("div", {
				className: "rounded-xl border border-line bg-white p-3.5 text-xs leading-5",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "font-bold text-ink",
						children: [
							"Hướng dẫn thùng rác công cộng (",
							guide.categoryName,
							")"
						]
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "mt-1 font-semibold text-brand-deep",
						children: ["Màu thùng rác quy định: ", guide.standardBinColor]
					}),
					prepSteps.length > 0 && /* @__PURE__ */ jsx("ul", {
						className: "mt-1.5 list-disc space-y-0.5 pl-4 text-body",
						children: prepSteps.map((s) => /* @__PURE__ */ jsx("li", { children: s }, s))
					}),
					guide.hazardWarning && /* @__PURE__ */ jsxs("p", {
						className: "mt-1.5 text-warn",
						children: [
							/* @__PURE__ */ jsx("b", { children: "Lưu ý:" }),
							" ",
							guide.hazardWarning
						]
					})
				]
			}),
			(fallback?.allowCommunityPickupPost ?? true) && /* @__PURE__ */ jsxs("div", {
				className: "rounded-xl border border-brand/25 bg-brand/6 p-3.5 text-xs",
				children: [
					/* @__PURE__ */ jsx("p", {
						className: "font-semibold text-ink",
						children: "Đăng yêu cầu thu gom chờ đối tác nhận đơn"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-body",
						children: "Bạn vẫn có thể tạo lịch hẹn trước; cơ sở thu gom quanh khu vực sẽ nhận được thông báo ngay khi bật trực tuyến."
					}),
					/* @__PURE__ */ jsx(Link, {
						to: "/user/handover",
						className: "btn-outline mt-2.5 h-9 px-3.5 text-xs",
						children: "Tạo yêu cầu thu gom trước"
					})
				]
			})
		]
	});
}
function ActivePin({ label }) {
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsxs("span", {
		className: "-mb-1.5 flex max-w-[220px] items-center gap-1.5 rounded-full border border-white/25 bg-brand-deep px-3 py-1.5 text-[11px] font-semibold tracking-[0.2px] text-white shadow-[0_10px_15px_-3px_rgba(0,0,0,0.18)]",
		children: [
			/* @__PURE__ */ jsx(TruckIcon, {}),
			/* @__PURE__ */ jsx("span", {
				className: "truncate",
				children: label
			}),
			/* @__PURE__ */ jsx("i", { className: "size-1.5 shrink-0 rounded-full bg-mint-bright" })
		]
	}), /* @__PURE__ */ jsx("span", { className: "size-2.5 rotate-45 bg-brand-deep" })] });
}
function SimplePin({ label }) {
	return /* @__PURE__ */ jsxs("span", {
		className: "flex max-w-[200px] items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]",
		children: [/* @__PURE__ */ jsx(PinIcon, {}), /* @__PURE__ */ jsx("span", {
			className: "truncate",
			children: label
		})]
	});
}
var stroke$1 = {
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function PinIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "14",
		height: "15",
		viewBox: "0 0 14 15",
		fill: "none",
		"aria-hidden": "true",
		className: "shrink-0 text-brand",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M7 14s5-4.2 5-8A5 5 0 002 6c0 3.8 5 8 5 8z",
			...stroke$1
		}), /* @__PURE__ */ jsx("circle", {
			cx: "7",
			cy: "6",
			r: "1.8",
			...stroke$1
		})]
	});
}
function CrosshairIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 14 14",
		fill: "none",
		"aria-hidden": "true",
		className: "text-ink",
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "7",
			cy: "7",
			r: "3.4",
			...stroke$1
		}), /* @__PURE__ */ jsx("path", {
			d: "M7 1v1.8M7 11.2V13M1 7h1.8M11.2 7H13",
			...stroke$1
		})]
	});
}
function TruckIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "15",
		height: "10",
		viewBox: "0 0 16 11",
		fill: "none",
		"aria-hidden": "true",
		className: "shrink-0",
		children: [
			/* @__PURE__ */ jsx("path", {
				d: "M1 1h8.5v8H1V1zM9.5 3.6H13l2 2.4v3H9.5V3.6z",
				...stroke$1
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "4.2",
				cy: "9.6",
				r: "1.4",
				...stroke$1
			}),
			/* @__PURE__ */ jsx("circle", {
				cx: "11.8",
				cy: "9.6",
				r: "1.4",
				...stroke$1
			})
		]
	});
}
function VerifiedIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "14",
		height: "14",
		viewBox: "0 0 16 16",
		fill: "none",
		"aria-hidden": "true",
		className: "shrink-0 text-brand",
		children: [/* @__PURE__ */ jsx("circle", {
			cx: "8",
			cy: "8",
			r: "7",
			...stroke$1
		}), /* @__PURE__ */ jsx("path", {
			d: "M5.6 8.2l1.7 1.7 3.2-3.4",
			...stroke$1
		})]
	});
}
function PhoneIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "13",
		height: "13",
		viewBox: "0 0 14 14",
		fill: "none",
		"aria-hidden": "true",
		className: "text-brand-deep",
		children: /* @__PURE__ */ jsx("path", {
			d: "M4 1.8l2 2.4-1.4 1.4c.7 1.5 1.9 2.7 3.4 3.4l1.4-1.4 2.4 2c.2.2.2.6 0 .8l-1 1C10 12.4 7.4 9.8 6.6 8.6L3.2 6.8c-.2-.2-.2-.6 0-.8l1-1c.2-.2.6-.2.8 0z",
			...stroke$1
		})
	});
}
//#endregion
//#region src/data/partners.ts
var MATERIAL_TYPES = [
	"Tất cả loại phế liệu",
	"Nhựa PET & HDPE",
	"Giấy & bìa carton",
	"Kim loại & sắt thép",
	"Điện tử & pin Li-ion"
];
var REGIONS = [
	"Tất cả khu vực",
	"TP. Hồ Chí Minh",
	"Bình Dương & Đồng Nai",
	"Hà Nội & vùng lân cận",
	"Đà Nẵng & miền Trung"
];
var PARTNERS = [
	{
		name: "Công ty CP Tái chế Nhựa Duy Tân",
		region: "TP. Hồ Chí Minh & Long An, Bình Dương",
		certification: "ISO 14001",
		logo: "/assets/partners/2917f.png",
		materials: [
			"Nhựa PET công nghiệp",
			"Can & Chai HDPE",
			"Màng PP kiện"
		],
		minWeight: "Tối thiểu từ 100 kg",
		perk: "Hỗ trợ xe ép tận nơi"
	},
	{
		name: "Nhà máy Giấy & Bao bì Đồng Tiến",
		region: "Bình Dương, Đồng Nai & TP.HCM",
		certification: "FSC CoC",
		logo: "/assets/partners/14343.png",
		materials: [
			"Thùng Carton OCC",
			"Hồ sơ văn phòng hủy bảo mật",
			"Giấy bao bì phức hợp"
		],
		minWeight: "Tối thiểu từ 500 kg",
		perk: "Quy trình hủy có camera giám sát"
	},
	{
		name: "Tập đoàn Môi trường Xanh EGreen",
		region: "Khu công nghiệp Hà Nội & Bình Dương, TP.HCM",
		certification: "Hạng A TN&MT",
		logo: "/assets/partners/8f44f.png",
		materials: [
			"Sắt thép kết cấu phế liệu",
			"Đồng cáp, Nhôm định hình",
			"Thủy tinh công nghiệp"
		],
		minWeight: "Tối thiểu từ 2 tấn",
		perk: "Hỗ trợ tháo dỡ xưởng trọn gói"
	},
	{
		name: "Việt Nam Tái Chế (Vietnam Recycles)",
		region: "Hà Nội, TP.HCM & Đà Nẵng",
		certification: "Chứng nhận ESG",
		logo: "/assets/partners/46206.png",
		materials: [
			"Máy tính, Màn hình, Máy chủ",
			"Pin Li-ion, Ắc quy hết hạn",
			"Linh kiện điện tử hư hỏng"
		],
		minWeight: "Tối thiểu từ 50 kg",
		perk: "Hỗ trợ tiêu hủy an toàn dữ liệu"
	}
];
var CTA = {
	kicker: "Dành cho đơn vị xử lý có giấy phép",
	title: "Trở thành nhà máy đối tác trong mạng lưới EcoLink",
	body: "Tiếp cận nguồn nguyên liệu thu gom ổn định từ hàng nghìn tòa nhà, xí nghiệp và doanh nghiệp đối tác phát thải trên toàn quốc.",
	action: "Đăng ký đối tác"
};
//#endregion
//#region src/pages/Partners.tsx
function Partners() {
	const [query, setQuery] = useState("");
	const [material, setMaterial] = useState(MATERIAL_TYPES[0]);
	const [region, setRegion] = useState(REGIONS[0]);
	const [liveRecyclers, setLiveRecyclers] = useState([]);
	useEffect(() => {
		const controller = new AbortController();
		searchNearbyRecyclers({
			lat: LOCATION_PRESETS[0].lat,
			lng: LOCATION_PRESETS[0].lng,
			radiusKm: 25
		}, controller.signal).then((res) => {
			if (!controller.signal.aborted && res.data.items.length > 0) setLiveRecyclers(res.data.items);
		}).catch(() => {});
		return () => controller.abort();
	}, []);
	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		return PARTNERS.filter((p) => {
			const matchQuery = !q || p.name.toLowerCase().includes(q) || p.certification.toLowerCase().includes(q) || p.materials.some((m) => m.toLowerCase().includes(q));
			const matchMaterial = material === MATERIAL_TYPES[0] || p.materials.join(" ").includes(material.replace(/ &.*/, ""));
			const matchRegion = region === REGIONS[0] || p.region.includes(region);
			return matchQuery && matchMaterial && matchRegion;
		});
	}, [
		query,
		material,
		region
	]);
	const reset = () => {
		setQuery("");
		setMaterial(MATERIAL_TYPES[0]);
		setRegion(REGIONS[0]);
	};
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("section", {
		className: "border-b border-sage/20 bg-white pt-12 pb-14",
		children: /* @__PURE__ */ jsxs("div", {
			className: "page",
			children: [
				/* @__PURE__ */ jsxs("span", {
					className: "chip border border-sage/20 bg-surface-3 text-brand-deep",
					children: [/* @__PURE__ */ jsx(BadgeIcon, {}), "Hệ thống đối tác kiểm định tiêu chuẩn"]
				}),
				/* @__PURE__ */ jsx("h1", {
					className: "display mt-1 text-3xl leading-10 md:text-[32px]",
					children: "Đối tác tái chế quy mô lớn"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-3 max-w-2xl text-lg leading-[29.25px] text-body",
					children: "Kết nối trực tiếp các đơn vị phát thải lớn và hộ gia đình với mạng lưới cơ sở thu mua đã xác minh cùng nhà máy tái chế quy chuẩn."
				})
			]
		})
	}), /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6 py-10",
		children: [
			liveRecyclers.length > 0 && /* @__PURE__ */ jsxs("section", {
				className: "flex flex-col gap-4 rounded-2xl border border-brand/25 bg-surface p-6",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center justify-between gap-3",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("span", {
						className: "eyebrow",
						children: "TRỰC TUYẾN TRÊN BẢN ĐỒ"
					}), /* @__PURE__ */ jsxs("h2", {
						className: "mt-1 text-xl font-bold text-ink",
						children: [
							"Cơ sở thu mua đã xác minh đang mở cửa (",
							liveRecyclers.length,
							")"
						]
					})] }), /* @__PURE__ */ jsxs(Link, {
						to: "/map",
						className: "btn-outline h-10 px-4 text-xs",
						children: ["Mở bản đồ GPS quanh bạn", /* @__PURE__ */ jsx(ArrowIcon, {})]
					})]
				}), /* @__PURE__ */ jsx("div", {
					className: "grid gap-4 md:grid-cols-2",
					children: liveRecyclers.slice(0, 4).map((r) => /* @__PURE__ */ jsxs("div", {
						className: "flex flex-col justify-between gap-3 rounded-xl border border-line bg-white p-4",
						children: [/* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-start justify-between gap-2",
								children: [/* @__PURE__ */ jsx("h3", {
									className: "text-base font-bold text-ink",
									children: r.facilityName
								}), /* @__PURE__ */ jsx("span", {
									className: "shrink-0 rounded-full bg-surface-3 px-2.5 py-0.5 text-xs font-semibold text-brand-deep",
									children: formatDistance(r.distanceKm)
								})]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-1 text-xs text-muted",
								children: r.address
							}),
							/* @__PURE__ */ jsx("ul", {
								className: "mt-2.5 flex flex-wrap gap-1.5",
								children: r.materials.slice(0, 4).map((m) => /* @__PURE__ */ jsxs("li", {
									className: "rounded bg-surface-2 px-2 py-1 text-xs text-ink",
									children: [
										m.categoryName.replace(/\s*\(.*\)/, ""),
										":",
										" ",
										/* @__PURE__ */ jsxs("b", {
											className: "text-brand-deep",
											children: [formatVnd(m.pricePerKg), "/kg"]
										})
									]
								}, m.categoryCode))
							})
						] }), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center justify-between border-t border-line-soft pt-3 text-xs",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "text-muted",
								children: ["Giờ mở cửa: ", r.operatingHours]
							}), /* @__PURE__ */ jsx(Link, {
								to: `/map`,
								className: "font-semibold text-brand-deep hover:underline",
								children: "Xem trên bản đồ →"
							})]
						})]
					}, r.id))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-3 rounded-xl border border-sage/30 bg-white p-5 shadow-[0_2px_6px_rgba(0,0,0,0.02)] lg:flex-row lg:items-center",
				children: [
					/* @__PURE__ */ jsx("input", {
						type: "search",
						value: query,
						onChange: (e) => setQuery(e.target.value),
						placeholder: "Tìm theo tên nhà máy, chứng chỉ...",
						"aria-label": "Tìm đối tác",
						className: "h-11 min-w-0 flex-1 rounded-lg border border-sage-line bg-surface-2 py-3 pr-4 pl-4 text-sm text-ink placeholder:text-muted focus:outline-none"
					}),
					/* @__PURE__ */ jsx(Select, {
						label: "Loại phế liệu",
						value: material,
						options: MATERIAL_TYPES,
						onChange: setMaterial,
						className: "lg:w-60"
					}),
					/* @__PURE__ */ jsx(Select, {
						label: "Khu vực",
						value: region,
						options: REGIONS,
						onChange: setRegion,
						className: "lg:w-56"
					}),
					/* @__PURE__ */ jsxs("button", {
						type: "button",
						onClick: reset,
						className: "btn-ghost h-11 shrink-0",
						children: [/* @__PURE__ */ jsx(ResetIcon, {}), "Đặt lại"]
					})
				]
			}),
			/* @__PURE__ */ jsxs("header", {
				className: "flex items-center justify-between pt-4 pb-2",
				children: [/* @__PURE__ */ jsxs("h2", {
					className: "flex items-center gap-2 text-xl leading-7 font-bold tracking-tight text-ink",
					children: ["Nhà máy đối tác chọn lọc", /* @__PURE__ */ jsxs("span", {
						className: "chip bg-surface-2 text-muted",
						children: [filtered.length, " đơn vị"]
					})]
				}), /* @__PURE__ */ jsxs("span", {
					className: "chip hidden bg-surface-2 text-body sm:inline-flex",
					children: [/* @__PURE__ */ jsx("i", { className: "size-1.5 rounded-full bg-brand" }), "Hệ thống vận hành 24/7"]
				})]
			}),
			filtered.length > 0 ? /* @__PURE__ */ jsx("div", {
				className: "grid gap-6 md:grid-cols-2",
				children: filtered.map((p) => /* @__PURE__ */ jsx(PartnerCard, { partner: p }, p.name))
			}) : /* @__PURE__ */ jsxs("p", {
				className: "card p-10 text-center text-sm text-muted",
				children: [
					"Không tìm thấy đơn vị phù hợp. Thử bỏ bớt bộ lọc hoặc",
					" ",
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: reset,
						className: "font-semibold text-brand-deep",
						children: "đặt lại"
					}),
					"."
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "mt-6 flex flex-col items-start justify-between gap-6 rounded-xl border border-sage/30 bg-white p-8 shadow-[0_1px_2px_rgba(0,0,0,0.02)] md:flex-row md:items-center md:p-10",
				children: [/* @__PURE__ */ jsxs("div", { children: [
					/* @__PURE__ */ jsx("span", {
						className: "text-[11px] font-semibold tracking-[0.33px] text-brand-soft uppercase",
						children: CTA.kicker
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "mt-1 text-2xl leading-7 font-bold tracking-tight text-ink",
						children: CTA.title
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-2 max-w-xl text-sm leading-[22.75px] text-body",
						children: CTA.body
					})
				] }), /* @__PURE__ */ jsxs(Link, {
					to: "/join-recycler",
					className: "btn-primary h-11 shrink-0 rounded-lg px-5",
					children: [CTA.action, /* @__PURE__ */ jsx(ArrowIcon, {})]
				})]
			})
		]
	})] });
}
function Select({ label, value, options, onChange, className = "" }) {
	return /* @__PURE__ */ jsxs("div", {
		className: `relative shrink-0 ${className}`,
		children: [/* @__PURE__ */ jsx("select", {
			"aria-label": label,
			value,
			onChange: (e) => onChange(e.target.value),
			className: "h-11 w-full appearance-none rounded-lg bg-surface-2 py-2.5 pr-10 pl-4 text-sm text-ink focus:outline-none",
			children: options.map((o) => /* @__PURE__ */ jsx("option", {
				value: o,
				children: o
			}, o))
		}), /* @__PURE__ */ jsx(ChevronIcon, {})]
	});
}
function PartnerCard({ partner }) {
	return /* @__PURE__ */ jsxs("article", {
		className: "flex flex-col justify-between rounded-xl border border-sage/30 bg-white p-6",
		children: [/* @__PURE__ */ jsxs("div", { children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex items-start justify-between gap-4",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex items-center gap-3.5",
					children: [/* @__PURE__ */ jsx("img", {
						src: partner.logo,
						alt: partner.name,
						className: "size-14 shrink-0 rounded-lg border border-sage/20 bg-surface-2 object-cover",
						loading: "lazy"
					}), /* @__PURE__ */ jsxs("div", {
						className: "flex flex-col gap-0.5",
						children: [/* @__PURE__ */ jsx("h3", {
							className: "text-xl leading-7 font-semibold text-ink",
							children: partner.name
						}), /* @__PURE__ */ jsx("p", {
							className: "text-sm leading-5 text-body",
							children: partner.region
						})]
					})]
				}), /* @__PURE__ */ jsx("span", {
					className: "shrink-0 rounded-md border border-sage/20 bg-surface-3 px-3 py-1.5 text-[11px] font-semibold text-brand-deep",
					children: partner.certification
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "pt-2",
				children: [/* @__PURE__ */ jsx("p", {
					className: "text-[11px] font-semibold tracking-[0.55px] text-muted uppercase",
					children: "Chủng loại thu mua chính:"
				}), /* @__PURE__ */ jsx("ul", {
					className: "mt-1.5 flex flex-wrap gap-1.5",
					children: partner.materials.map((m) => /* @__PURE__ */ jsx("li", {
						className: "self-stretch rounded bg-surface-2 px-2.5 py-1 text-xs leading-4 text-body",
						children: m
					}, m))
				})]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-3 flex items-center justify-between border-t border-sage/15 pt-2.5 pb-2",
				children: [/* @__PURE__ */ jsx("span", {
					className: "text-sm text-body",
					children: "Khối lượng tiếp nhận:"
				}), /* @__PURE__ */ jsx("span", {
					className: "text-sm font-semibold text-brand-deep",
					children: partner.minWeight
				})]
			})
		] }), /* @__PURE__ */ jsxs("div", {
			className: "flex items-center justify-between gap-3 border-t border-sage/20 pt-5",
			children: [/* @__PURE__ */ jsxs("span", {
				className: "flex items-center gap-2 text-xs text-body",
				children: [/* @__PURE__ */ jsx("i", { className: "size-1.5 rounded-full bg-brand" }), partner.perk]
			}), /* @__PURE__ */ jsxs(Link, {
				to: "/map",
				className: "btn h-9 shrink-0 border border-brand/30 bg-white px-4 text-xs text-brand-deep",
				children: ["Liên hệ thu gom", /* @__PURE__ */ jsx(ArrowIcon, {})]
			})]
		})]
	});
}
var stroke = {
	stroke: "currentColor",
	strokeWidth: 1.5,
	strokeLinecap: "round",
	strokeLinejoin: "round"
};
function BadgeIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "15",
		height: "15",
		viewBox: "0 0 16 16",
		fill: "none",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M8 1.5l5 2v4.2c0 3.1-2 5.6-5 6.8-3-1.2-5-3.7-5-6.8V3.5l5-2z",
			...stroke
		}), /* @__PURE__ */ jsx("path", {
			d: "M5.8 8.2l1.6 1.6 3-3.2",
			...stroke
		})]
	});
}
function ChevronIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "10",
		height: "6",
		viewBox: "0 0 10 6",
		fill: "none",
		"aria-hidden": "true",
		className: "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted",
		children: /* @__PURE__ */ jsx("path", {
			d: "M1 1l4 4 4-4",
			...stroke
		})
	});
}
function ResetIcon() {
	return /* @__PURE__ */ jsxs("svg", {
		width: "12",
		height: "12",
		viewBox: "0 0 12 12",
		fill: "none",
		"aria-hidden": "true",
		children: [/* @__PURE__ */ jsx("path", {
			d: "M10.5 6a4.5 4.5 0 11-1.6-3.42",
			...stroke
		}), /* @__PURE__ */ jsx("path", {
			d: "M10.8 1v2.4H8.4",
			...stroke
		})]
	});
}
function ArrowIcon() {
	return /* @__PURE__ */ jsx("svg", {
		width: "11",
		height: "11",
		viewBox: "0 0 12 12",
		fill: "none",
		"aria-hidden": "true",
		children: /* @__PURE__ */ jsx("path", {
			d: "M2 6h8m0 0L6.5 2.5M10 6l-3.5 3.5",
			...stroke
		})
	});
}
//#endregion
//#region src/data/feedback.ts
var CATEGORIES = [{
	id: "complaint",
	label: "Khiếu nại",
	blurb: "Có gì đã sai và cần được xử lý. Chúng tôi phản hồi trong 24 giờ."
}, {
	id: "suggestion",
	label: "Góp ý",
	blurb: "Ý tưởng để EcoLink làm tốt hơn. Chúng tôi đọc hết và ghi nhận."
}];
/** id: dùng để chọn mức phản hồi, cũng là chuỗi gửi lên backend. */
var ISSUES = {
	complaint: [
		{
			id: "collect-missed",
			label: "Không có người thu gom đến"
		},
		{
			id: "collect-late",
			label: "Đến sai giờ so với lịch hẹn",
			hint: "Lệch quá 2 giờ"
		},
		{
			id: "weight",
			label: "Khối lượng cộng điểm bị sai"
		},
		{
			id: "sorting",
			label: "Phân loại sai vật liệu"
		},
		{
			id: "collector-attitude",
			label: "Thái độ người thu gom"
		},
		{
			id: "points",
			label: "Vấn đề điểm hoặc đổi quà"
		},
		{
			id: "app-bug",
			label: "Ứng dụng bị lỗi"
		},
		{
			id: "safety",
			label: "An toàn hoặc môi trường",
			hint: "Xử lý trong 4 giờ"
		}
	],
	suggestion: [
		{
			id: "feature",
			label: "Muốn có thêm tính năng"
		},
		{
			id: "experience",
			label: "Trải nghiệm dùng app"
		},
		{
			id: "partner",
			label: "Đề xuất đối tác thu gom hoặc tái chế"
		},
		{
			id: "content",
			label: "Nội dung hướng dẫn phân loại"
		},
		{
			id: "other",
			label: "Góp ý khác"
		}
	]
};
/** Cam kết xử lý. Hiện ở ngay cạnh nút gửi để người gửi biết mình chờ được gì. */
var SLA = {
	"collect-missed": "Phản hồi trong 24 giờ",
	"collect-late": "Phản hồi trong 24 giờ",
	weight: "Đối chiếu dữ liệu cân trong 48 giờ",
	sorting: "Phản hồi trong 24 giờ",
	"collector-attitude": "Xác minh với đối tác trong 48 giờ",
	points: "Sửa điểm trong 24 giờ",
	"app-bug": "Phản hồi trong 24 giờ",
	safety: "Ưu tiên cao nhất, phản hồi trong 4 giờ",
	feature: "Chúng tôi ghi nhận, phản hồi theo chu kỳ phát triển",
	experience: "Chúng tôi ghi nhận, phản hồi theo chu kỳ phát triển",
	partner: "Chuyển phòng hợp tác, phản hồi trong 5 ngày",
	content: "Chúng tôi ghi nhận, phản hồi theo chu kỳ nội dung",
	other: "Chúng tôi ghi nhận, phản hồi theo chu kỳ phát triển"
};
/** 3 bước sau khi gửi. Nói rõ để người gửi không phải tự hỏi. */
var STEPS = [
	{
		title: "Nhận mã tiếp nhận",
		body: "Mã hiện ngay trên màn hình, có trong email xác nhận. Giữ mã này để tra cứu."
	},
	{
		title: "Điều phối viên liên hệ",
		body: "Điều phối viên phụ trách khu vực của bạn gọi lại trong thời hạn ở trên."
	},
	{
		title: "Kết quả và bồi thường",
		body: "Báo lại kết quả trên app. Sai khối lượng sẽ được cộng lại điểm tự động."
	}
];
/** FAQ dùng <details>/<summary> gốc của trình duyệt, không cần state. */
var FAQ = [
	{
		q: "Tôi cần tài khoản để gửi khiếu nại không?",
		a: "Không. Người dùng chưa đăng nhập vẫn gửi được, chỉ cần để lại email hoặc số điện thoại để chúng tôi gọi lại. Có tài khoản thì chúng tôi tự điền hộ tên."
	},
	{
		q: "Bao lâu thì được phản hồi?",
		a: "Khiếu nại về an toàn và môi trường trong 4 giờ, phần lớn khiếu nại trong 24 giờ, đối chiếu dữ liệu cân thì 48 giờ. Góp ý không có hạn cụ thể vì phụ thuộc chu kỳ phát triển."
	},
	{
		q: "Tôi nên chụp ảnh gì?",
		a: "Ảnh chụp rác, biển số xe người thu gom, ảnh màn hình hiển thị điểm, hoặc ảnh thẻ khi đổi quà. Ảnh rõ nét giúp xử lý nhanh hơn nhiều."
	},
	{
		q: "Khiếu nại của tôi có bị mất không?",
		a: "Không. Mọi khiếu nại đều lưu kèm thời điểm, khu vực và mã tiếp nhận. Nếu quá 5 ngày làm việc chưa có phản hồi, bạn gọi 1900 8828 và đưa mã tiếp nhận."
	},
	{
		q: "Có phải trả phí gửi khiếu nại không?",
		a: "Không. Gửi khiếu nại và góp ý hoàn toàn miễn phí, kể cả khi kết quả là không có lỗi của phía EcoLink."
	}
];
var DESC_MAX = 1e3;
/** SĐT Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx, cho phép khoảng trắng, gạch, chấm. */
function isPhone(v) {
	return /^(?:\+84|0)\d{9,10}$/.test(v.replace(/[\s.\-()]/g, ""));
}
function isEmail(v) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
/** Đây là ranh giới tin cậy: dữ liệu từ người dùng vào hệ thống. Không kiểm
*  tra thì đơn không xử lý được mà vẫn báo "đã gửi" — tệ hơn không có form. */
function validate(d) {
	const e = {};
	if (!d.issue) e.issue = "Chọn loại vấn đề để chúng tôi chuyển đúng bộ phận";
	const desc = d.desc.trim();
	if (desc.length < 20) e.desc = `Mô tả ít nhất 20 ký tự, hiện mới ${desc.length}`;
	else if (desc.length > 1e3) e.desc = `Tối đa ${DESC_MAX} ký tự, hiện ${desc.length}`;
	if (!d.contact.trim()) e.contact = "Cần email hoặc số điện thoại để gọi lại cho bạn";
	else if (!isEmail(d.contact) && !isPhone(d.contact)) e.contact = "Email hoặc số điện thoại chưa đúng định dạng";
	if (d.photos.length > 4) e.photos = `Tối đa 4 ảnh`;
	return e;
}
/** Mã tiếp nhận dạng KN-260928-4F7A: ngày + 4 ký tự ngẫu nhiên. Người gửi đọc
*  qua điện thoại thì dễ đọc hơn mã dài. */
function makeRef(d = /* @__PURE__ */ new Date()) {
	const p = (n) => String(n).padStart(2, "0");
	return `KN-${`${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}`}-${Array.from({ length: 4 }, () => "0123456789ABCDEFGHJKLMNPQRSTVWXYZ"[Math.floor(Math.random() * 32)]).join("")}`;
}
//#endregion
//#region src/pages/Feedback.tsx
function Feedback() {
	const user = useUser();
	const [cat, setCat] = useState("complaint");
	const [issue, setIssue] = useState("");
	const [desc, setDesc] = useState("");
	const [contact, setContact] = useState("");
	const [photos, setPhotos] = useState([]);
	const [errs, setErrs] = useState({});
	const [ref, setRef] = useState("");
	const list = ISSUES[cat];
	const pickCat = (c) => {
		if (c === cat) return;
		setCat(c);
		setIssue("");
		setErrs((e) => ({
			...e,
			issue: void 0
		}));
	};
	const send = (e) => {
		e.preventDefault();
		const found = validate({
			category: cat,
			issue,
			desc,
			contact,
			photos
		});
		setErrs(found);
		if (Object.values(found).some(Boolean)) return;
		setRef(makeRef());
	};
	if (ref) return /* @__PURE__ */ jsx(Done$1, {
		refCode: ref,
		cat
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col pb-16",
		children: [/* @__PURE__ */ jsxs("header", {
			className: "pt-10 md:pt-14",
			children: [/* @__PURE__ */ jsx("h1", {
				className: "display text-[28px] leading-9 md:text-[34px] md:leading-11",
				children: "Khiếu nại và góp ý"
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-2 max-w-[62ch] text-base leading-7 text-body",
				children: "Thu gom bị trễ, điểm cộng sai, app lỗi, hay bạn nghĩ EcoLink nên làm khác đi. Gửi ở đây, chúng tôi xử lý và báo lại kết quả."
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-10",
			children: [/* @__PURE__ */ jsxs("form", {
				onSubmit: send,
				noValidate: true,
				className: "min-w-0",
				children: [
					/* @__PURE__ */ jsxs("fieldset", { children: [/* @__PURE__ */ jsx("legend", {
						className: "text-sm font-bold text-ink",
						children: "Loại nội dung"
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-3 grid gap-3 sm:grid-cols-2",
						children: CATEGORIES.map((c) => {
							const on = c.id === cat;
							return /* @__PURE__ */ jsxs("label", {
								className: `cursor-pointer rounded-xl border p-4 transition-colors ${on ? "border-brand bg-brand/8" : "border-line bg-surface hover:bg-surface-2"}`,
								children: [
									/* @__PURE__ */ jsx("input", {
										type: "radio",
										name: "category",
										value: c.id,
										checked: on,
										onChange: () => pickCat(c.id),
										className: "sr-only"
									}),
									/* @__PURE__ */ jsxs("span", {
										className: "flex items-center gap-2",
										children: [/* @__PURE__ */ jsx("span", {
											className: `grid size-4 shrink-0 place-items-center rounded-full border-2 ${on ? "border-brand" : "border-sage-line"}`,
											children: on && /* @__PURE__ */ jsx("span", { className: "size-1.5 rounded-full bg-brand" })
										}), /* @__PURE__ */ jsx("span", {
											className: "text-sm font-bold text-ink",
											children: c.label
										})]
									}),
									/* @__PURE__ */ jsx("span", {
										className: "mt-1.5 block text-[13px] leading-5 text-muted",
										children: c.blurb
									})
								]
							}, c.id);
						})
					})] }),
					/* @__PURE__ */ jsxs("fieldset", {
						className: "mt-7",
						children: [
							/* @__PURE__ */ jsxs("legend", {
								className: "text-sm font-bold text-ink",
								children: [
									"Vấn đề cụ thể",
									" ",
									/* @__PURE__ */ jsx("span", {
										className: "font-normal text-muted",
										children: "(bắt buộc)"
									})
								]
							}),
							/* @__PURE__ */ jsx("div", {
								className: "mt-3 flex flex-wrap gap-2",
								children: list.map((it) => {
									const on = issue === it.id;
									return /* @__PURE__ */ jsxs("label", {
										className: `cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${on ? "border-brand bg-brand text-white" : "border-line bg-surface text-body hover:bg-surface-2"}`,
										children: [/* @__PURE__ */ jsx("input", {
											type: "radio",
											name: "issue",
											value: it.id,
											checked: on,
											onChange: () => {
												setIssue(it.id);
												setErrs((e) => ({
													...e,
													issue: void 0
												}));
											},
											className: "sr-only"
										}), it.label]
									}, it.id);
								})
							}),
							issue && /* @__PURE__ */ jsx("p", {
								className: "mt-3 text-[13px] text-brand",
								children: SLA[issue]
							}),
							errs.issue && /* @__PURE__ */ jsx(FieldError, { text: errs.issue })
						]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-7",
						children: [
							/* @__PURE__ */ jsxs("label", {
								htmlFor: "fb-desc",
								className: "text-sm font-bold text-ink",
								children: ["Mô tả chi tiết ", /* @__PURE__ */ jsx("span", {
									className: "font-normal text-muted",
									children: "(bắt buộc)"
								})]
							}),
							/* @__PURE__ */ jsx("textarea", {
								id: "fb-desc",
								value: desc,
								onChange: (e) => setDesc(e.target.value.slice(0, DESC_MAX)),
								rows: 5,
								"aria-invalid": !!errs.desc,
								"aria-describedby": "fb-desc-hint",
								placeholder: "Ngày giờ, địa chỉ, mã lịch thu gom nếu có. Càng cụ thể càng xử lý nhanh.",
								className: `input mt-2 h-auto resize-y py-3 leading-6 ${errs.desc ? "border-warn" : ""}`
							}),
							/* @__PURE__ */ jsxs("div", {
								id: "fb-desc-hint",
								className: "mt-1.5 flex flex-wrap justify-between gap-2 text-[13px]",
								children: [errs.desc ? /* @__PURE__ */ jsx("span", {
									className: "text-warn",
									children: errs.desc
								}) : /* @__PURE__ */ jsx("span", {
									className: "text-muted",
									children: "Nêu rõ điều bạn mong đổi xảy ra, không chỉ điều đã xảy ra."
								}), /* @__PURE__ */ jsxs("span", {
									className: "tabular-nums text-muted",
									children: [
										desc.trim().length,
										" / ",
										DESC_MAX,
										desc.trim().length < 20 && ` (tối thiểu 20)`
									]
								})]
							})
						]
					}),
					/* @__PURE__ */ jsx(Photos, {
						photos,
						setPhotos,
						error: errs.photos,
						clearError: () => setErrs((e) => ({
							...e,
							photos: void 0
						}))
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-7 grid gap-5 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("label", {
							htmlFor: "fb-name",
							className: "text-sm font-bold text-ink",
							children: "Họ tên"
						}), /* @__PURE__ */ jsx("input", {
							id: "fb-name",
							defaultValue: user,
							placeholder: user ? "" : "Không bắt buộc",
							className: "input mt-2"
						})] }), /* @__PURE__ */ jsxs("div", { children: [
							/* @__PURE__ */ jsxs("label", {
								htmlFor: "fb-contact",
								className: "text-sm font-bold text-ink",
								children: [
									"Email hoặc số điện thoại",
									" ",
									/* @__PURE__ */ jsx("span", {
										className: "font-normal text-muted",
										children: "(bắt buộc)"
									})
								]
							}),
							/* @__PURE__ */ jsx("input", {
								id: "fb-contact",
								value: contact,
								onChange: (e) => {
									setContact(e.target.value);
									setErrs((x) => ({
										...x,
										contact: void 0
									}));
								},
								inputMode: "email",
								autoComplete: "email",
								placeholder: "ban@email.vn hoặc 0901234567",
								"aria-invalid": !!errs.contact,
								"aria-describedby": "fb-contact-err",
								className: `input mt-2 ${errs.contact ? "border-warn" : ""}`
							}),
							errs.contact && /* @__PURE__ */ jsx("p", {
								id: "fb-contact-err",
								className: "mt-1.5 text-[13px] text-warn",
								children: errs.contact
							})
						] })]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "mt-8 flex flex-wrap items-center gap-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn btn-primary h-12 px-7",
							children: "Gửi nội dung"
						}), /* @__PURE__ */ jsx("p", {
							className: "text-[13px] text-muted",
							children: "Miễn phí. Thông tin chỉ dùng để xử lý việc bạn báo."
						})]
					})
				]
			}), /* @__PURE__ */ jsxs("aside", {
				className: "min-w-0",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "rounded-2xl border border-line bg-surface p-5",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-base font-bold text-ink",
							children: "Sau khi bạn gửi"
						}),
						/* @__PURE__ */ jsx("ol", {
							className: "mt-4 flex flex-col gap-4",
							children: STEPS.map((s, i) => /* @__PURE__ */ jsxs("li", {
								className: "flex gap-3",
								children: [/* @__PURE__ */ jsx("span", {
									className: "grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white",
									children: i + 1
								}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
									className: "text-sm font-semibold text-ink",
									children: s.title
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-0.5 text-[13px] leading-5 text-muted",
									children: s.body
								})] })]
							}, s.title))
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "mt-5 border-t border-line-soft pt-4 text-sm leading-6 text-body",
							children: [
								"Gấp hơn? Gọi",
								" ",
								/* @__PURE__ */ jsx("a", {
									href: `tel:${SUPPORT.links[0].split(" ")[0]}`,
									className: "font-semibold text-brand hover:text-brand-deep",
									children: SUPPORT.links[0]
								}),
								" ",
								"hoặc",
								" ",
								/* @__PURE__ */ jsx("a", {
									href: `mailto:${SUPPORT.links[1]}`,
									className: "font-semibold text-brand hover:text-brand-deep",
									children: SUPPORT.links[1]
								}),
								"."
							]
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "mt-6",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-base font-bold text-ink",
						children: "Câu hỏi thường gặp"
					}), /* @__PURE__ */ jsx("div", {
						className: "mt-3 divide-y divide-line-soft overflow-hidden rounded-2xl border border-line bg-surface",
						children: FAQ.map((f) => /* @__PURE__ */ jsxs("details", {
							className: "group px-5 py-4",
							children: [/* @__PURE__ */ jsx("summary", {
								className: "cursor-pointer list-none text-sm font-semibold text-ink marker:content-none",
								children: /* @__PURE__ */ jsxs("span", {
									className: "flex items-start justify-between gap-3",
									children: [f.q, /* @__PURE__ */ jsx("span", {
										className: "mt-0.5 shrink-0 text-muted transition-transform group-open:rotate-45",
										children: /* @__PURE__ */ jsx("svg", {
											viewBox: "0 0 24 24",
											className: "size-4",
											fill: "none",
											stroke: "currentColor",
											strokeWidth: "2",
											strokeLinecap: "round",
											"aria-hidden": "true",
											children: /* @__PURE__ */ jsx("path", { d: "M12 5v14M5 12h14" })
										})
									})]
								})
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-2.5 text-[13px] leading-6 text-body",
								children: f.a
							})]
						}, f.q))
					})]
				})]
			})]
		})]
	});
}
function FieldError({ text }) {
	return /* @__PURE__ */ jsx("p", {
		className: "mt-2.5 text-[13px] text-warn",
		children: text
	});
}
function Photos({ photos, setPhotos, error, clearError }) {
	const input = useRef(null);
	const [note, setNote] = useState("");
	const add = (list) => {
		if (!list) return;
		const next = [];
		let skipped = 0;
		for (const f of Array.from(list)) {
			if (!f.type.startsWith("image/") || f.size > 5242880) {
				skipped++;
				continue;
			}
			if (photos.length + next.length >= 4) {
				skipped++;
				continue;
			}
			next.push(f);
		}
		if (skipped) setNote(`Bỏ qua ${skipped} ảnh: sai định dạng, quá 5MB hoặc vượt quá 4 ảnh.`);
		else setNote("");
		if (next.length) {
			setPhotos([...photos, ...next]);
			clearError();
		}
		if (input.current) input.current.value = "";
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "mt-7",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "text-sm font-bold text-ink",
				children: "Ảnh minh hoạ"
			}),
			/* @__PURE__ */ jsxs("span", {
				className: "ml-2 text-[13px] text-muted",
				children: [
					"không bắt buộc, tối đa ",
					4,
					" ảnh"
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "mt-2.5 flex flex-wrap gap-3",
				children: [photos.map((f, i) => /* @__PURE__ */ jsxs("div", {
					className: "relative",
					children: [/* @__PURE__ */ jsx(Thumb, {
						file: f,
						alt: `Ảnh đính kèm ${i + 1}`
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setPhotos(photos.filter((_, n) => n !== i)),
						"aria-label": `Xoá ảnh ${i + 1}`,
						className: "absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-ink text-white",
						children: /* @__PURE__ */ jsx("svg", {
							viewBox: "0 0 24 24",
							className: "size-3.5",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2.5",
							strokeLinecap: "round",
							"aria-hidden": "true",
							children: /* @__PURE__ */ jsx("path", { d: "M18 6 6 18M6 6l12 12" })
						})
					})]
				}, `${f.name}-${i}`)), photos.length < 4 && /* @__PURE__ */ jsxs("label", {
					className: "grid aspect-square w-28 cursor-pointer place-items-center rounded-xl border border-dashed border-sage-line bg-surface text-center transition-colors hover:bg-surface-2",
					children: [/* @__PURE__ */ jsx("input", {
						ref: input,
						type: "file",
						accept: "image/*",
						multiple: true,
						onChange: (e) => add(e.target.files),
						className: "sr-only"
					}), /* @__PURE__ */ jsxs("span", {
						className: "px-2",
						children: [/* @__PURE__ */ jsx("svg", {
							viewBox: "0 0 24 24",
							className: "mx-auto size-6 text-muted",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.6",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: /* @__PURE__ */ jsx("path", { d: "M12 16V4M8 8l4-4 4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" })
						}), /* @__PURE__ */ jsx("span", {
							className: "mt-1.5 block text-[11px] leading-4 text-muted",
							children: "Chọn ảnh"
						})]
					})]
				})]
			}),
			(note || error) && /* @__PURE__ */ jsx("p", {
				className: "mt-2.5 text-[13px] text-warn",
				children: error || note
			})
		]
	});
}
function Thumb({ file, alt }) {
	const [url, setUrl] = useState(null);
	useEffect(() => {
		const u = URL.createObjectURL(file);
		setUrl(u);
		return () => URL.revokeObjectURL(u);
	}, [file]);
	if (!url) return /* @__PURE__ */ jsx("span", { className: "size-28 rounded-xl border border-line bg-surface-2" });
	return /* @__PURE__ */ jsx("img", {
		src: url,
		alt,
		className: "size-28 rounded-xl border border-line object-cover"
	});
}
/** Màn hình xác nhận. Mã tiếp nhận là thứ duy nhất người gửi cần mang đi. */
function Done$1({ refCode, cat }) {
	const [copied, setCopied] = useState(false);
	return /* @__PURE__ */ jsx("div", {
		className: "page flex flex-col pb-16",
		children: /* @__PURE__ */ jsxs("div", {
			className: "mt-10 max-w-[60ch] md:mt-14",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "grid size-12 place-items-center rounded-full bg-brand text-white",
					children: /* @__PURE__ */ jsx("svg", {
						viewBox: "0 0 24 24",
						className: "size-6",
						fill: "none",
						stroke: "currentColor",
						strokeWidth: "2.2",
						strokeLinecap: "round",
						strokeLinejoin: "round",
						"aria-hidden": "true",
						children: /* @__PURE__ */ jsx("path", { d: "m5 13 4 4L19 7" })
					})
				}),
				/* @__PURE__ */ jsxs("h1", {
					className: "display mt-5 text-[26px] leading-9 md:text-[32px]",
					children: [
						"Đã ghi nhận ",
						cat === "complaint" ? "khiếu nại" : "góp ý",
						" của bạn"
					]
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-3 text-base leading-7 text-body",
					children: "Chúng tôi gửi mã này qua email và sẽ liên hệ trong thời hạn đã cam kết. Nếu gấp, gọi 1900 8828 và đưa mã dưới đây."
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-7 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-xs font-semibold tracking-[0.14em] text-muted uppercase",
						children: "Mã tiếp nhận"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink",
						children: refCode
					})] }), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => {
							navigator.clipboard?.writeText(refCode);
							setCopied(true);
						},
						className: "btn btn-outline ml-auto",
						children: copied ? "Đã chép" : "Chép mã"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-8 flex flex-wrap gap-3",
					children: [/* @__PURE__ */ jsx("a", {
						href: "/",
						className: "btn btn-primary h-12 px-6",
						children: "Về trang chủ"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => location.reload(),
						className: "btn btn-ghost h-12 px-6",
						children: "Gửi thêm nội dung"
					})]
				})
			]
		})
	});
}
//#endregion
//#region src/pages/Guidance.tsx
/** U-02 Tra cứu hướng dẫn phân loại rác & U-04 Báo cáo AI nhận diện sai.
*
*  Kết nối trực tiếp với Rule Engine tại `GET /api/v1/waste-scan/rules` để đồng bộ
*  màu thùng rác chuẩn, các bước sơ chế và cảnh báo an toàn; đồng thời giữ dữ liệu
*  nền `WASTES` để render tức thì (SSR-safe) ngay cả khi chưa bật Backend. */
function Guidance() {
	const [group, setGroup] = useState(WASTE_GROUPS[1]);
	const [liveRules, setLiveRules] = useState([]);
	const [syncedFromApi, setSyncedFromApi] = useState(false);
	useEffect(() => {
		const controller = new AbortController();
		fetchSortingRules(controller.signal).then((rules) => {
			if (rules.length > 0) {
				setLiveRules(rules);
				setSyncedFromApi(true);
			}
		}).catch(() => {});
		return () => controller.abort();
	}, []);
	const matchedLiveRules = liveRules.filter((r) => getCategoryMeta(r.categoryCode).group === group);
	const fallbackList = WASTES.filter((w) => w.group === group);
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "HƯỚNG DẪN",
				title: "Phân loại rác đúng cách",
				body: "Chọn nhóm vật liệu để xem quy định màu thùng rác, cách sơ chế sạch và hướng xử lý từ Rule Engine. Rác chuẩn bị đúng bán được giá cao hơn và không bị từ chối khi bàn giao.",
				action: syncedFromApi ? /* @__PURE__ */ jsxs("span", {
					className: "chip bg-surface-2 text-body",
					children: [/* @__PURE__ */ jsx("i", { className: "size-1.5 rounded-full bg-brand" }), "Đã đồng bộ Rule Engine"]
				}) : void 0
			}),
			/* @__PURE__ */ jsx("div", {
				className: "flex flex-wrap gap-2",
				children: WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0]).map((g) => /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setGroup(g),
					"aria-pressed": group === g,
					className: `rounded-full border px-4 py-2 text-[13px] font-semibold transition-colors ${group === g ? "border-brand bg-brand text-white" : "border-line bg-surface text-body hover:bg-surface-2"}`,
					children: g
				}, g))
			}),
			matchedLiveRules.length > 0 ? /* @__PURE__ */ jsx("ol", {
				className: "flex flex-col gap-3",
				children: matchedLiveRules.map((rule, i) => {
					const steps = parsePreparationSteps(rule.preparationSteps);
					const canTrade = isDiscoverableCategory(rule.categoryCode);
					return /* @__PURE__ */ jsxs("li", {
						className: "card flex flex-col gap-3 p-5 sm:flex-row sm:gap-4",
						children: [/* @__PURE__ */ jsx("span", {
							className: "grid size-8 shrink-0 place-items-center rounded-full bg-brand/12 text-sm font-bold text-brand-deep",
							children: i + 1
						}), /* @__PURE__ */ jsxs("div", {
							className: "min-w-0 flex-1",
							children: [
								/* @__PURE__ */ jsxs("div", {
									className: "flex flex-wrap items-center justify-between gap-2",
									children: [/* @__PURE__ */ jsx("h2", {
										className: "text-base leading-6 font-bold text-ink",
										children: rule.categoryName
									}), /* @__PURE__ */ jsxs("span", {
										className: "rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep",
										children: ["Thùng rác màu: ", rule.standardBinColor]
									})]
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1.5 text-sm leading-6 text-body",
									children: rule.handlingAction
								}),
								steps.length > 0 && /* @__PURE__ */ jsxs("div", {
									className: "mt-2.5 rounded-lg border border-line-soft bg-surface-2 px-3.5 py-2.5 text-[13px] leading-5 text-ink",
									children: [/* @__PURE__ */ jsx("b", { children: "Các bước sơ chế chuẩn:" }), /* @__PURE__ */ jsx("ul", {
										className: "mt-1 list-disc space-y-0.5 pl-4 text-body",
										children: steps.map((s) => /* @__PURE__ */ jsx("li", { children: s }, s))
									})]
								}),
								rule.hazardWarning && /* @__PURE__ */ jsxs("p", {
									className: "mt-2 text-xs leading-5 text-warn",
									children: [
										/* @__PURE__ */ jsx("b", { children: "Lưu ý an toàn:" }),
										" ",
										rule.hazardWarning
									]
								}),
								canTrade && /* @__PURE__ */ jsx("div", {
									className: "mt-3",
									children: /* @__PURE__ */ jsxs(Link, {
										to: `/map?category=${encodeURIComponent(rule.categoryCode)}`,
										className: "text-xs font-semibold text-brand-deep underline underline-offset-4 hover:text-brand",
										children: [
											"Tìm cơ sở thu mua ",
											rule.categoryName,
											" gần bạn →"
										]
									})
								})
							]
						})]
					}, rule.categoryCode);
				})
			}) : /* @__PURE__ */ jsx("ol", {
				className: "flex flex-col gap-3",
				children: fallbackList.map((w, i) => /* @__PURE__ */ jsxs("li", {
					className: "card flex gap-4 p-5",
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-8 shrink-0 place-items-center rounded-full bg-brand/12 text-sm font-bold text-brand-deep",
						children: i + 1
					}), /* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [
							/* @__PURE__ */ jsx("h2", {
								className: "text-base leading-6 font-bold text-ink",
								children: w.name
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-1 text-sm leading-6 text-body",
								children: w.rule
							}),
							/* @__PURE__ */ jsxs("p", {
								className: "mt-2 text-[13px] leading-5 text-muted",
								children: [
									/* @__PURE__ */ jsx("b", {
										className: "text-ink",
										children: "Chuẩn bị:"
									}),
									" ",
									w.prep
								]
							})
						]
					})]
				}, w.id))
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "card flex flex-wrap items-center justify-between gap-4 p-5",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
					className: "text-base font-bold text-ink",
					children: "Không chắc mình bỏ đúng nhóm?"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-muted",
					children: "Chụp một ảnh, AI nhận diện vật liệu và trả lời luôn màu thùng rác kèm điểm thu mua."
				})] }), /* @__PURE__ */ jsx(Link, {
					to: "/scanner",
					className: "btn-primary h-11 shrink-0 px-5",
					children: "Nhận diện bằng AI"
				})]
			}),
			/* @__PURE__ */ jsx(U04Report, {})
		]
	});
}
/** U-04 Báo cáo AI nhận diện sai — gửi thực tế lên POST /api/v1/waste-scan/feedback. */
function U04Report() {
	const [predicted, setPredicted] = useState("plastic");
	const [correct, setCorrect] = useState("");
	const [note, setNote] = useState("");
	const [sending, setSending] = useState(false);
	const [sentMessage, setSentMessage] = useState("");
	const [errMessage, setErrMessage] = useState("");
	const handleReport = async () => {
		if (!correct || sending) return;
		setSending(true);
		setErrMessage("");
		setSentMessage("");
		try {
			const res = await submitAiFeedback({
				predictedLabel: predicted,
				confidenceScore: .55,
				userReportedLabel: correct,
				note: note.trim() || void 0
			});
			setSentMessage(res.message);
			setNote("");
		} catch (err) {
			setErrMessage(err instanceof Error ? err.message : "Không kết nối được máy chủ để gửi báo cáo. Vui lòng thử lại sau.");
		} finally {
			setSending(false);
		}
	};
	return /* @__PURE__ */ jsxs("section", {
		className: "card flex flex-col gap-4 p-5 md:p-6",
		children: [
			/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "AI chỉ sai loại rác"
			}), /* @__PURE__ */ jsx("p", {
				className: "mt-1 text-sm text-muted",
				children: "Chọn nhãn AI đã báo nhầm và loại rác thực tế. Nhân viên vận hành kiểm chứng và đưa vào tập dữ liệu huấn luyện lại (Retrain Loop)."
			})] }),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ jsx(Field$2, {
						label: "Nhãn AI đã dự đoán nhầm",
						children: /* @__PURE__ */ jsx("select", {
							className: "input",
							value: predicted,
							onChange: (e) => {
								setPredicted(e.target.value);
								setSentMessage("");
							},
							children: AI_CLASS_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
								value: opt.code,
								children: opt.label
							}, opt.code))
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Loại rác đúng thực tế",
						children: /* @__PURE__ */ jsxs("select", {
							className: "input",
							value: correct,
							onChange: (e) => {
								setCorrect(e.target.value);
								setSentMessage("");
							},
							children: [/* @__PURE__ */ jsx("option", {
								value: "",
								children: "Chọn loại rác đúng"
							}), AI_CLASS_OPTIONS.map((opt) => /* @__PURE__ */ jsx("option", {
								value: opt.code,
								children: opt.label
							}, opt.code))]
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Ghi chú (không bắt buộc)",
						children: /* @__PURE__ */ jsx("input", {
							className: "input",
							value: note,
							onChange: (e) => setNote(e.target.value),
							placeholder: "Ví dụ: ảnh chụp ngược sáng, nền tối"
						})
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-4",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						disabled: !correct || sending,
						onClick: handleReport,
						className: "btn-primary h-11 px-6",
						children: sending ? "Đang gửi..." : "Gửi báo cáo"
					}),
					sentMessage && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: sentMessage
					}),
					errMessage && /* @__PURE__ */ jsx("p", {
						role: "alert",
						className: "text-[13px] font-medium text-warn",
						children: errMessage
					})
				]
			})
		]
	});
}
//#endregion
//#region src/pages/Waste.tsx
var WASTE_TO_API_CATEGORY = {
	pet: "plastic",
	hdpe: "plastic",
	carton: "cardboard",
	"office-paper": "paper",
	steel: "metal",
	aluminum: "metal",
	glass: "glass",
	organic: "trash"
};
/** U-03 Tìm kiếm & xem chi tiết loại rác — bổ sung đồng bộ từ Rule Engine API
*  và nối thẳng sang tìm cơ sở thu mua trên bản đồ `/map?category=...`. */
function Waste() {
	const [q, setQ] = useState("");
	const [group, setGroup] = useState(WASTE_GROUPS[0]);
	const [only, setOnly] = useState("all");
	const [items, setItems] = useState(() => WASTES.map((w) => ({
		...w,
		categoryCode: WASTE_TO_API_CATEGORY[w.id]
	})));
	useEffect(() => {
		const controller = new AbortController();
		fetchSortingRules(controller.signal).then((rules) => {
			if (rules.length === 0) return;
			const byCode = new Map(rules.map((r) => [r.categoryCode.toLowerCase(), r]));
			setItems(WASTES.map((w) => {
				const code = WASTE_TO_API_CATEGORY[w.id];
				const rule = code ? byCode.get(code) : void 0;
				if (!rule) return {
					...w,
					categoryCode: code
				};
				const steps = parsePreparationSteps(rule.preparationSteps);
				return {
					...w,
					categoryCode: code,
					binColor: rule.standardBinColor,
					rule: rule.handlingAction || w.rule,
					prep: steps.length > 0 ? steps.join(" • ") : w.prep,
					group: getCategoryMeta(code).group
				};
			}));
		}).catch(() => {});
		return () => controller.abort();
	}, []);
	const list = useMemo(() => {
		const k = q.trim().toLowerCase();
		return items.filter((w) => {
			const hitQ = !k || w.name.toLowerCase().includes(k) || w.rule.toLowerCase().includes(k) || w.prep.toLowerCase().includes(k);
			const hitG = group === WASTE_GROUPS[0] || w.group === group;
			const hitR = only === "all" || w.recyclable === (only === "yes");
			return hitQ && hitG && hitR;
		});
	}, [
		items,
		q,
		group,
		only
	]);
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "TRA CỨU",
				title: "Loại rác và cách xử lý",
				body: "Giá tham khảo và cách chuẩn bị cho từng loại từ Rule Engine. Số tiền thực tế chốt khi bàn giao, theo khối lượng cơ sở thu mua cân."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "card flex flex-col gap-4 p-4 md:flex-row md:items-end",
				children: [
					/* @__PURE__ */ jsx("div", {
						className: "min-w-0 flex-1",
						children: /* @__PURE__ */ jsx(Field$2, {
							label: "Tìm theo tên loại rác",
							children: /* @__PURE__ */ jsx("input", {
								className: "input",
								type: "search",
								value: q,
								onChange: (e) => setQ(e.target.value),
								placeholder: "Ví dụ: chai nhựa, carton, lon nhôm"
							})
						})
					}),
					/* @__PURE__ */ jsx("div", {
						className: "md:w-52",
						children: /* @__PURE__ */ jsx(Field$2, {
							label: "Nhóm vật liệu",
							children: /* @__PURE__ */ jsx("select", {
								className: "input",
								value: group,
								onChange: (e) => setGroup(e.target.value),
								children: WASTE_GROUPS.map((g) => /* @__PURE__ */ jsx("option", {
									value: g,
									children: g
								}, g))
							})
						})
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex items-center gap-2 pb-3 text-[13px] text-body md:pb-0",
						children: [/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							className: "size-4 accent-brand",
							checked: only === "yes",
							onChange: (e) => setOnly(e.target.checked ? "yes" : "all")
						}), "Chỉ loại thu gom được"]
					})
				]
			}),
			list.length === 0 ? /* @__PURE__ */ jsx(Empty, { children: "Không có loại rác nào khớp bộ lọc. Bạn có thể chụp ảnh để AI nhận diện giúp." }) : /* @__PURE__ */ jsx("ul", {
				className: "grid gap-4 md:grid-cols-2",
				children: list.map((w) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-3 p-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("h2", {
									className: "text-base leading-6 font-bold text-ink",
									children: w.name
								}), /* @__PURE__ */ jsxs("p", {
									className: "mt-0.5 text-[13px] text-muted",
									children: [w.group, w.binColor ? ` · Thùng màu ${w.binColor}` : ""]
								})]
							}), /* @__PURE__ */ jsx("span", {
								className: "shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-body",
								children: w.recyclable ? "Thu gom được" : "Không thu gom"
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-[13px] leading-5 text-body",
							children: w.rule
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "rounded-lg border border-line-soft bg-surface-2 px-3 py-2 text-[13px] leading-5 text-ink",
							children: [
								/* @__PURE__ */ jsx("b", { children: "Chuẩn bị:" }),
								" ",
								w.prep
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-auto flex flex-wrap items-center justify-between gap-2 pt-1",
							children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-bold tabular-nums text-brand",
								children: w.recyclable ? `${VND(w.price)} / kg` : "Không thu gom trong hệ thống"
							}), w.recyclable && isDiscoverableCategory(w.categoryCode) && /* @__PURE__ */ jsx(Link, {
								to: `/map?category=${encodeURIComponent(w.categoryCode)}`,
								className: "text-xs font-semibold text-brand-deep hover:underline",
								children: "Tìm nơi thu mua →"
							})]
						})
					]
				}, w.id))
			})
		]
	});
}
//#endregion
//#region src/pages/Chat.tsx
var SEED = [
	{
		id: 1,
		from: "them",
		text: "Chào bạn, bên mình đang mở cửa nhận thu gom hôm nay. Bạn cần bán loại phế liệu nào và khoảng bao nhiêu kg?",
		time: "09:12"
	},
	{
		id: 2,
		from: "me",
		text: "Mình có khoảng 15kg nhựa sạch đã tráng nước và 10kg bìa carton gập phẳng.",
		time: "09:15"
	},
	{
		id: 3,
		from: "them",
		text: "Tuyệt vời. Bạn chọn khung giờ 10:00 - 12:00 nhé, bên mình ghé cân tận nơi luôn.",
		time: "09:16"
	}
];
function Chat() {
	const [searchParams] = useSearchParams();
	const role = useRole();
	const userName = useUser();
	const partnerFromMap = searchParams.get("partnerName");
	const addressFromMap = searchParams.get("partnerAddress");
	const me = userName || (role === "recycler" ? "Cô Ba Thu Gom" : "Nguyễn Đức");
	const them = role === "recycler" ? "Nguyễn Đức" : partnerFromMap || "Cô Ba Thu Gom";
	const displayAddress = addressFromMap || "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1";
	const [msgs, setMsgs] = useState(SEED);
	const [draft, setDraft] = useState("");
	const send = (e) => {
		e.preventDefault();
		const text = draft.trim();
		if (!text) return;
		const now = /* @__PURE__ */ new Date();
		setMsgs((ms) => [...ms, {
			id: ms.length + 1,
			from: "me",
			text,
			time: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
		}]);
		setDraft("");
	};
	const handoverLink = role === "recycler" ? "/recycler/requests" : partnerFromMap ? `/user/handover?partnerName=${encodeURIComponent(partnerFromMap)}` : "/user/handover";
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "THƯƠNG LƯỢNG",
				title: `Chat với ${them}`,
				body: "Dùng để thống nhất giá, khối lượng và khung giờ trước khi bàn giao. Nội dung chat không thay thế biên nhận — tiền chỉ chốt sau khi bạn xác nhận khối lượng thực."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "card flex h-[560px] flex-col overflow-hidden",
				children: [
					/* @__PURE__ */ jsxs("header", {
						className: "flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("p", {
								className: "truncate font-bold text-ink",
								children: them
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-0.5 text-[13px] text-muted",
								children: displayAddress
							})]
						}), /* @__PURE__ */ jsxs("span", {
							className: "chip shrink-0 bg-surface-2 text-body",
							children: [/* @__PURE__ */ jsx("i", { className: "size-1.5 rounded-full bg-brand" }), "Đang hoạt động"]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-1 flex-col gap-3 overflow-y-auto p-5",
						children: [/* @__PURE__ */ jsx("p", {
							className: "self-stretch rounded-full bg-surface-3 px-3 py-1 text-center text-[12px] text-body",
							children: "Hôm nay"
						}), msgs.map((m) => /* @__PURE__ */ jsx("div", {
							className: m.from === "me" ? "w-full pl-10" : "w-full pr-10",
							children: /* @__PURE__ */ jsxs("div", {
								className: `flex flex-col ${m.from === "me" ? "items-end" : "items-start"}`,
								children: [/* @__PURE__ */ jsx("div", {
									className: `max-w-[80%] rounded-2xl px-4 py-2.5 ${m.from === "me" ? "bg-brand-deep text-white" : "bg-surface-2 text-ink"}`,
									children: /* @__PURE__ */ jsx("p", {
										className: "text-sm leading-6",
										children: m.text
									})
								}), /* @__PURE__ */ jsx("p", {
									className: "mt-1 px-1 text-[11px] text-muted",
									children: m.time
								})]
							})
						}, m.id))]
					}),
					/* @__PURE__ */ jsxs("form", {
						onSubmit: send,
						className: "flex items-center gap-2 border-t border-line px-4 py-3",
						children: [
							/* @__PURE__ */ jsxs("label", {
								className: "sr-only",
								htmlFor: "chat-draft",
								children: ["Nhắn tin với ", them]
							}),
							/* @__PURE__ */ jsx("input", {
								id: "chat-draft",
								value: draft,
								onChange: (e) => setDraft(e.target.value),
								placeholder: `Nhắn tin với ${them}...`,
								className: "input h-11"
							}),
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: !draft.trim(),
								className: "btn-primary h-11 shrink-0 px-5",
								children: "Gửi"
							})
						]
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "card flex flex-wrap items-center justify-between gap-4 p-5",
				children: [/* @__PURE__ */ jsxs("p", {
					className: "max-w-[60ch] text-sm leading-6 text-body",
					children: [/* @__PURE__ */ jsx("b", {
						className: "text-ink",
						children: me
					}), ", khi thống nhất xong thì bấm bên dưới để tạo yêu cầu bàn giao chính thức. Không có yêu cầu thì hệ thống không biết chuyển tiền cho ai."]
				}), /* @__PURE__ */ jsx(Link, {
					to: handoverLink,
					className: "btn-outline h-11 shrink-0 px-5",
					children: "Tạo yêu cầu bàn giao"
				})]
			})
		]
	});
}
//#endregion
//#region src/pages/JoinRecycler.tsx
/** U-05 Đăng ký tài khoản thu mua.
*
*  Tách khỏi `/register` vì đây là quy trình khác hẳn: có giấy phép phải
*  thẩm định, không có thì không được đứng trong nhà người dân và nhận tiền
*  mặt của họ. Nhồi vào form đăng ký chung thì form dài gấp đôi và người
*  dân phải đọc qua mấy ô không liên quan tới mình.
*
*  Chưa có backend: bấm gửi thì chỉ hiện mã hồ sơ để người dùng mang đi. */
function JoinRecycler() {
	const [docs, setDocs] = useState([]);
	const [name, setName] = useState("");
	const [owner, setOwner] = useState("");
	const [phone, setPhone] = useState("");
	const [address, setAddress] = useState("");
	const [mats, setMats] = useState([]);
	const [ref, setRef] = useState("");
	const [err, setErr] = useState("");
	const MATERIALS = [
		"Nhựa",
		"Giấy và bìa carton",
		"Kim loại",
		"Thủy tinh",
		"Điện tử",
		"Rác hữu cơ"
	];
	const submit = (e) => {
		e.preventDefault();
		if (name.trim().length < 3) {
			setErr("Cần tên cơ sở để thẩm định hồ sơ.");
			return;
		}
		if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
			setErr("Số điện thoại chưa đúng định dạng Việt Nam.");
			return;
		}
		if (!address.trim()) {
			setErr("Cần địa chỉ nơi thu gom thực tế.");
			return;
		}
		if (mats.length === 0) {
			setErr("Chọn ít nhất một loại rác bạn thu mua.");
			return;
		}
		if (docs.length === 0) {
			setErr("Tải ít nhất một giấy tờ để hồ sơ được thẩm định.");
			return;
		}
		setErr("");
		setRef(`HS-${(/* @__PURE__ */ new Date()).getFullYear()}-${Math.floor(1e3 + Math.random() * 9e3)}`);
	};
	if (ref) return /* @__PURE__ */ jsx(Done, {
		id: ref,
		name
	});
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "ĐỐI TÁC THU MUA",
			title: "Đăng ký cơ sở thu mua",
			body: "Điền hồ sơ và tải giấy tờ lên. Hồ sơ được thẩm định trong 3 ngày làm việc, trước khi điểm của bạn hiện trên bản đồ GPS."
		}), /* @__PURE__ */ jsxs("form", {
			onSubmit: submit,
			noValidate: true,
			className: "card flex flex-col gap-6 p-5 md:p-6",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "grid gap-5 sm:grid-cols-2",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Tên cơ sở", /* @__PURE__ */ jsx("input", {
								className: `input ${err.startsWith("Cần tên") ? "border-warn" : ""}`,
								value: name,
								onChange: (e) => setName(e.target.value),
								placeholder: "Vựa Minh Khai"
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Người đại diện", /* @__PURE__ */ jsx("input", {
								className: "input",
								value: owner,
								onChange: (e) => setOwner(e.target.value),
								placeholder: "Nguyễn Văn A"
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Số điện thoại", /* @__PURE__ */ jsx("input", {
								className: `input tabular-nums ${err.startsWith("Số điện thoại") ? "border-warn" : ""}`,
								inputMode: "tel",
								value: phone,
								onChange: (e) => setPhone(e.target.value),
								placeholder: "0901 234 567"
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Email", /* @__PURE__ */ jsx("input", {
								className: "input",
								type: "email",
								placeholder: "ten@thugom.vn"
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
					children: ["Địa chỉ thu gom", /* @__PURE__ */ jsx("input", {
						className: `input ${err.startsWith("Cần địa chỉ") ? "border-warn" : ""}`,
						value: address,
						onChange: (e) => setAddress(e.target.value),
						placeholder: "512 Hai Bà Trưng, Quận 5"
					})]
				}),
				/* @__PURE__ */ jsxs("fieldset", { children: [/* @__PURE__ */ jsx("legend", {
					className: "text-[13px] font-semibold text-ink",
					children: "Loại rác bạn thu mua"
				}), /* @__PURE__ */ jsx("div", {
					className: "mt-2 flex flex-wrap gap-2",
					children: MATERIALS.map((m) => {
						const on = mats.includes(m);
						return /* @__PURE__ */ jsxs("label", {
							className: `cursor-pointer rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors ${on ? "border-brand bg-brand text-white" : "border-line bg-surface text-body hover:bg-surface-2"}`,
							children: [/* @__PURE__ */ jsx("input", {
								type: "checkbox",
								className: "sr-only",
								checked: on,
								onChange: () => setMats((ms) => on ? ms.filter((x) => x !== m) : [...ms, m])
							}), m]
						}, m);
					})
				})] }),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-col gap-2",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "text-[13px] font-semibold text-ink",
							children: "Giấy tờ bắt buộc"
						}),
						/* @__PURE__ */ jsx("span", {
							className: "text-[12px] text-muted",
							children: "Giấy đăng ký doanh nghiệp hoặc hộ kinh doanh, và giấy phép thu gom chất thải rắn. Ảnh chụp rõ chữ, không cắt mép giấy. Tối đa 5 tệp."
						}),
						/* @__PURE__ */ jsxs("label", {
							className: `mt-1 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center transition-colors ${err.startsWith("Tải ít nhất") ? "border-warn bg-surface-2" : "border-sage-line bg-surface-2 hover:bg-surface-3"}`,
							children: [
								/* @__PURE__ */ jsx("input", {
									type: "file",
									accept: "image/*,application/pdf",
									multiple: true,
									className: "sr-only",
									onChange: (e) => setDocs(Array.from(e.target.files ?? []).slice(0, 5))
								}),
								/* @__PURE__ */ jsx("span", {
									className: "text-sm font-semibold text-brand",
									children: docs.length === 0 ? "Chọn giấy tờ" : docs.map((d) => d.name).join(" · ")
								}),
								docs.length === 0 && /* @__PURE__ */ jsx("span", {
									className: "text-[12px] text-muted",
									children: "Chấp nhận ảnh và PDF"
								})
							]
						})
					]
				}),
				err && /* @__PURE__ */ jsx("p", {
					className: "text-[13px] text-warn",
					children: err
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-11 px-6",
						children: "Gửi hồ sơ thẩm định"
					}), /* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-muted",
						children: "Chờ duyệt thì bạn vẫn dùng được tài khoản người dân như thường."
					})]
				})
			]
		})]
	});
}
function Done({ id, name }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "ĐỐI TÁC THU MUA",
				title: "Đã nhận hồ sơ",
				body: `${name} đã gửi hồ sơ. Nhân viên EcoLink thẩm định trong 3 ngày làm việc và liên hệ qua số điện thoại bạn đăng ký.`
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "card flex flex-wrap items-center gap-4 px-5 py-4",
				children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
					className: "text-xs font-semibold tracking-[0.14em] text-muted uppercase",
					children: "Mã hồ sơ"
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-1 text-2xl font-bold tracking-tight tabular-nums text-ink",
					children: id
				})] }), /* @__PURE__ */ jsx("p", {
					className: "ml-auto text-sm text-body",
					children: "Mang mã này khi gọi 1900 8828 để tra nhanh."
				})]
			}),
			/* @__PURE__ */ jsx("ol", {
				className: "card flex flex-col gap-4 p-5",
				children: [
					["Nhận hồ sơ", "Chúng tôi kiểm tra giấy tờ còn hiệu lực trong 1 ngày làm việc."],
					["Thẩm định", "Nhân viên có thể gọi để xác minh địa chỉ thu gom thực tế."],
					["Duyệt và lên bản đồ", "Sau khi duyệt, bạn đặt bảng giá và bắt đầu nhận yêu cầu."]
				].map(([t, b], i) => /* @__PURE__ */ jsxs("li", {
					className: "flex gap-3",
					children: [/* @__PURE__ */ jsx("span", {
						className: "grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white",
						children: i + 1
					}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "text-sm font-semibold text-ink",
						children: t
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-0.5 text-[13px] leading-5 text-muted",
						children: b
					})] })]
				}, t))
			})
		]
	});
}
//#endregion
//#region src/pages/ResetPassword.tsx
function ResetPassword() {
	const [step, setStep] = useState("email");
	const [email, setEmail] = useState("");
	const [code, setCode] = useState("");
	const [password, setPassword] = useState("");
	const [flash, setFlash] = useState("");
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "KHÓA TÀI KHOẢN",
				title: "Đặt lại mật khẩu",
				body: "Nhận mã xác thực qua email đã đăng ký, đặt mật khẩu mới rồi đăng nhập lại. Người dân và cơ sở thu mua dùng chung quy trình này."
			}),
			/* @__PURE__ */ jsx("ol", {
				className: "flex flex-wrap items-center gap-3",
				children: [
					["Nhập email", "email"],
					["Nhập mã và mật khẩu mới", "code"],
					["Hoàn tất", "done"]
				].map(([label, id], i) => /* @__PURE__ */ jsxs("li", {
					className: "flex items-center gap-3",
					children: [
						/* @__PURE__ */ jsx("span", {
							className: `grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${step === id || done(step, id) ? "bg-brand text-white" : "bg-surface-2 text-muted"}`,
							children: i + 1
						}),
						/* @__PURE__ */ jsx("span", {
							className: `text-[13px] font-semibold ${step === id ? "text-ink" : "text-muted"}`,
							children: label
						}),
						i < 2 && /* @__PURE__ */ jsx("span", {
							className: "text-line",
							children: "—"
						})
					]
				}, id))
			}),
			step === "email" && /* @__PURE__ */ jsxs("form", {
				onSubmit: (e) => {
					e.preventDefault();
					if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
						setFlash("Email chưa đúng định dạng.");
						return;
					}
					setFlash("");
					setStep("code");
				},
				noValidate: true,
				className: "card flex max-w-[520px] flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: ["Email đã đăng ký", /* @__PURE__ */ jsx("input", {
							className: "input",
							type: "email",
							value: email,
							onChange: (e) => setEmail(e.target.value),
							placeholder: "ban@email.vn",
							autoComplete: "email"
						})]
					}),
					flash && /* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-warn",
						children: flash
					}),
					/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-11 px-6",
						children: "Gửi mã xác thực"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[13px] leading-5 text-muted",
						children: "Mã có hiệu lực 10 phút. Nếu không thấy trong hộp thư, kiểm tra thư mục quảng cáo hoặc thư rác."
					})
				]
			}),
			step === "code" && /* @__PURE__ */ jsxs("form", {
				onSubmit: (e) => {
					e.preventDefault();
					if (!/^\d{6}$/.test(code)) {
						setFlash("Mã xác thực gồm 6 chữ số.");
						return;
					}
					if (password.length < 8) {
						setFlash("Mật khẩu mới cần ít nhất 8 ký tự.");
						return;
					}
					setFlash("");
					setStep("done");
				},
				noValidate: true,
				className: "card flex max-w-[520px] flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsxs("p", {
						className: "text-sm text-body",
						children: [
							"Mã đã gửi tới ",
							/* @__PURE__ */ jsx("b", {
								className: "text-ink",
								children: email
							}),
							"."
						]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: ["Mã xác thực", /* @__PURE__ */ jsx("input", {
							className: "input tabular-nums",
							inputMode: "numeric",
							maxLength: 6,
							value: code,
							onChange: (e) => setCode(e.target.value.replace(/\D/g, "")),
							placeholder: "6 chữ số"
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: ["Mật khẩu mới", /* @__PURE__ */ jsx("input", {
							className: "input",
							type: "password",
							value: password,
							onChange: (e) => setPassword(e.target.value),
							placeholder: "Tối thiểu 8 ký tự",
							autoComplete: "new-password"
						})]
					}),
					flash && /* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-warn",
						children: flash
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Đặt mật khẩu mới"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => {
								setFlash("Đã gửi lại mã. Kiểm tra hộp thư trong vài phút nữa.");
								setCode("");
							},
							className: "btn-ghost h-11 px-5",
							children: "Gửi lại mã"
						})]
					})
				]
			}),
			step === "done" && /* @__PURE__ */ jsxs("div", {
				className: "card flex max-w-[520px] flex-col gap-4 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx("span", {
						className: "grid size-12 place-items-center rounded-full bg-brand text-white",
						children: /* @__PURE__ */ jsx("svg", {
							viewBox: "0 0 24 24",
							className: "size-6",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "2.2",
							strokeLinecap: "round",
							strokeLinejoin: "round",
							"aria-hidden": "true",
							children: /* @__PURE__ */ jsx("path", { d: "m5 13 4 4L19 7" })
						})
					}),
					/* @__PURE__ */ jsx("h2", {
						className: "text-lg leading-7 font-bold text-ink",
						children: "Đã đặt lại mật khẩu"
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm leading-6 text-body",
						children: "Đăng nhập lại bằng mật khẩu mới. Nếu có đăng nhập ở thiết bị khác mà không phải bạn, báo ngay để chúng tôi khoá phiên đó."
					}),
					/* @__PURE__ */ jsx("a", {
						href: "/login",
						className: "btn-primary h-11 w-fit px-6",
						children: "Đi tới đăng nhập"
					})
				]
			})
		]
	});
}
/** một bước đã đi qua = có id nằm sau `step` trong thứ tự email → code → done */
function done(step, id) {
	const order = [
		"email",
		"code",
		"done"
	];
	return order.indexOf(step) > order.indexOf(id);
}
//#endregion
//#region src/pages/Terms.tsx
function Terms() {
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-8 py-8",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "ĐIỀU KHOẢN & QUY ĐỊNH",
			title: "Điều khoản dịch vụ và chính sách môi trường",
			body: "Quy chuẩn hoạt động, quyền lợi của người dân và cơ sở thu gom, cùng cam kết minh bạch trong chuỗi giá trị thu gom tuần hoàn tại EcoLink."
		}), /* @__PURE__ */ jsx("div", {
			className: "grid gap-5 lg:grid-cols-2",
			children: [
				{
					title: "1. Nguyên tắc phân loại rác tại nguồn",
					body: "Người tham gia cam kết phân loại rác đúng theo hướng dẫn 3 nhóm (Tái chế, Hữu cơ, Khác). Rác tái chế cần được làm sạch cơ bản, để khô ráo trước khi đặt lịch bàn giao nhằm đảm bảo an toàn vệ sinh và tối ưu giá trị thu gom."
				},
				{
					title: "2. Quy chuẩn cân đo và biên nhận giao dịch",
					body: "Mọi giao dịch thu mua phế liệu qua nền tảng phải được cân đo minh bạch tại thời điểm bàn giao. Biên nhận điện tử được lập tức thì trên ứng dụng, ghi nhận khối lượng, đơn giá và số tiền/điểm xanh chuyển vào tài khoản."
				},
				{
					title: "3. Cơ chế tích lũy điểm xanh và đổi quà",
					body: "Điểm xanh được cộng dồn theo khối lượng rác tái chế đã bàn giao thành công. Điểm tiêu dùng có thể dùng để đổi quà tặng hoặc voucher đối tác. Điểm xếp hạng được bảo lưu trọn đời để thăng hạng cây ảo và mở khóa các huy hiệu cộng đồng."
				},
				{
					title: "4. Trách nhiệm của cơ sở thu gom và đối tác",
					body: "Cơ sở thu gom phải có giấy phép hoạt động hợp lệ, cam kết thu gom đúng hẹn và chuyển rác đến các nhà máy tái chế đạt chuẩn môi trường theo định hướng trách nhiệm mở rộng của nhà sản xuất (EPR)."
				},
				{
					title: "5. Bảo mật thông tin và quyền riêng tư",
					body: "EcoLink cam kết bảo vệ thông tin cá nhân và dữ liệu vị trí thu gom của người dùng. Dữ liệu chỉ được sử dụng cho mục đích điều phối lộ trình thu gom và thống kê báo cáo tác động môi trường số hóa."
				}
			].map((sec) => /* @__PURE__ */ jsxs("div", {
				className: "card p-6",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-base font-bold text-ink",
					children: sec.title
				}), /* @__PURE__ */ jsx("p", {
					className: "mt-2.5 text-sm leading-relaxed text-body",
					children: sec.body
				})]
			}, sec.title))
		})]
	});
}
//#endregion
//#region src/pages/EcoFactsPage.tsx
var STAGES = [
	{
		id: "seed",
		name: "Hạt mầm",
		reqExp: 40,
		desc: "Hạt mầm vừa gieo xuống lớp đất ẩm, cần tưới nước đều đặn."
	},
	{
		id: "sprout",
		name: "Chồi non",
		reqExp: 80,
		desc: "Chồi non vươn lên đón nắng, bắt đầu cần dinh dưỡng hữu cơ."
	},
	{
		id: "sapling",
		name: "Cây con",
		reqExp: 140,
		desc: "Thân cây cứng cáp dần, đâm chồi nảy lộc và tỏa bóng mát."
	},
	{
		id: "mature",
		name: "Cây trưởng thành",
		reqExp: 220,
		desc: "Cây xanh cổ thụ vững chãi, hấp thụ khí CO2 mỗi ngày."
	},
	{
		id: "flowering",
		name: "Ra hoa",
		reqExp: 300,
		desc: "Những đóa hoa nở rộ báo hiệu mùa quả ngọt sắp đến."
	},
	{
		id: "fruiting",
		name: "Kết quả ngọt",
		reqExp: 380,
		desc: "Cây trĩu quả tái chế! Thu hoạch để nhận thật nhiều EcoLink Coin."
	}
];
var STORAGE_KEY = "ecolink:virtual-tree-v1";
function loadInitialState() {
	if (typeof window === "undefined") return {
		stage: "sprout",
		exp: 20,
		maxExp: 80,
		water: 75,
		coins: 50,
		harvestReady: false,
		fruitsCount: 0,
		isDead: false
	};
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (raw) return JSON.parse(raw);
	} catch {}
	return {
		stage: "seed",
		exp: 10,
		maxExp: 40,
		water: 80,
		coins: 30,
		harvestReady: false,
		fruitsCount: 0,
		isDead: false
	};
}
function EcoFactsPage() {
	const [tree, setTree] = useState(loadInitialState);
	const [floatingCoins, setFloatingCoins] = useState([]);
	const [isWatering, setIsWatering] = useState(false);
	const [isFertilizing, setIsFertilizing] = useState(false);
	const treeContainerRef = useRef(null);
	useEffect(() => {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
		} catch {}
	}, [tree]);
	useEffect(() => {
		const timer = setInterval(() => {
			setTree((prev) => {
				if (prev.isDead) return prev;
				const newWater = Math.max(0, prev.water - 1);
				if (newWater === 0 && !prev.isDead) return {
					...prev,
					water: 0,
					isDead: true,
					stage: "seed",
					exp: 0,
					maxExp: 40,
					fruitsCount: 0,
					harvestReady: false
				};
				return {
					...prev,
					water: newWater
				};
			});
		}, 4500);
		return () => clearInterval(timer);
	}, []);
	const handleReplant = () => {
		setTree((prev) => ({
			...prev,
			stage: "seed",
			exp: 0,
			maxExp: 40,
			water: 80,
			isDead: false,
			fruitsCount: 0,
			harvestReady: false
		}));
	};
	const triggerCoinReward = (amount) => {
		const id = Date.now() + Math.random();
		const x = 40 + Math.random() * 20;
		const y = 30 + Math.random() * 20;
		setFloatingCoins((prev) => [...prev, {
			id,
			amount,
			x,
			y
		}]);
		setTimeout(() => {
			setFloatingCoins((prev) => prev.filter((c) => c.id !== id));
		}, 1200);
		setTree((prev) => ({
			...prev,
			coins: prev.coins + amount
		}));
	};
	const handleWater = () => {
		if (isWatering) return;
		setIsWatering(true);
		if (tree.isDead) {
			handleReplant();
			triggerCoinReward(3);
			setTimeout(() => setIsWatering(false), 900);
			return;
		}
		setTree((prev) => {
			const newWater = Math.min(100, prev.water + 30);
			const expGain = 10;
			const currentStageIdx = STAGES.findIndex((s) => s.id === prev.stage);
			const currentStageDef = STAGES[currentStageIdx];
			let newExp = prev.exp + expGain;
			let newStage = prev.stage;
			let newMax = prev.maxExp;
			let newHarvest = prev.harvestReady;
			let newFruits = prev.fruitsCount;
			if (newExp >= currentStageDef.reqExp && currentStageIdx < STAGES.length - 1) {
				const nextStage = STAGES[currentStageIdx + 1];
				newStage = nextStage.id;
				newMax = nextStage.reqExp;
				newExp = 0;
				if (newStage === "fruiting") {
					newHarvest = true;
					newFruits = 5;
				}
			}
			return {
				...prev,
				water: newWater,
				exp: newExp,
				maxExp: newMax,
				stage: newStage,
				harvestReady: newHarvest,
				fruitsCount: newFruits,
				isDead: false
			};
		});
		triggerCoinReward(3);
		setTimeout(() => setIsWatering(false), 900);
	};
	const handleFertilize = () => {
		if (isFertilizing) return;
		if (tree.isDead) return;
		setIsFertilizing(true);
		setTree((prev) => {
			const expGain = 25;
			const currentStageIdx = STAGES.findIndex((s) => s.id === prev.stage);
			const currentStageDef = STAGES[currentStageIdx];
			let newExp = prev.exp + expGain;
			let newStage = prev.stage;
			let newMax = prev.maxExp;
			let newHarvest = prev.harvestReady;
			let newFruits = prev.fruitsCount;
			if (newExp >= currentStageDef.reqExp && currentStageIdx < STAGES.length - 1) {
				const nextStage = STAGES[currentStageIdx + 1];
				newStage = nextStage.id;
				newMax = nextStage.reqExp;
				newExp = 0;
				if (newStage === "fruiting") {
					newHarvest = true;
					newFruits = 5;
				}
			}
			return {
				...prev,
				exp: newExp,
				maxExp: newMax,
				stage: newStage,
				harvestReady: newHarvest,
				fruitsCount: newFruits
			};
		});
		triggerCoinReward(6);
		setTimeout(() => setIsFertilizing(false), 900);
	};
	const handleHarvest = () => {
		if (!tree.harvestReady || tree.fruitsCount <= 0) return;
		triggerCoinReward(25);
		setTree((prev) => ({
			...prev,
			harvestReady: false,
			fruitsCount: 0,
			stage: "mature",
			exp: 0,
			maxExp: 300
		}));
	};
	const currentStage = STAGES[STAGES.findIndex((s) => s.id === tree.stage)];
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-8 py-8",
		children: [/* @__PURE__ */ jsx(PageHead$1, { title: "Virtual Tree · Cây Ảo EcoLink" }), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-8 lg:grid-cols-[1.2fr_1fr]",
			children: [/* @__PURE__ */ jsxs("div", {
				ref: treeContainerRef,
				className: "relative flex flex-col items-center justify-between overflow-hidden rounded-3xl border border-line bg-gradient-to-b from-[#eaf6ee] via-white to-[#f0f9f3] p-6 shadow-sm min-h-[460px]",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex w-full items-center justify-between",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2 rounded-full border border-line bg-white/90 px-3.5 py-1.5 shadow-2xs backdrop-blur-md",
							children: [/* @__PURE__ */ jsx("span", { className: "size-2 rounded-full bg-mint animate-pulse" }), /* @__PURE__ */ jsxs("span", {
								className: "text-xs font-bold text-ink",
								children: ["Giai đoạn: ", tree.isDead ? "Héo khô ⚠️" : currentStage.name]
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3.5 py-1.5 shadow-2xs",
							children: [/* @__PURE__ */ jsx("img", {
								src: "/assets/AI/ecolink-coin.png",
								alt: "Coin",
								className: "size-5 object-contain"
							}), /* @__PURE__ */ jsxs("span", {
								className: "text-sm font-bold text-amber-900",
								children: [
									tree.coins.toLocaleString("vi-VN"),
									" ",
									/* @__PURE__ */ jsx("span", {
										className: "text-xs font-semibold text-amber-700",
										children: "Coin"
									})
								]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "relative my-4 flex size-full max-w-[380px] items-center justify-center",
						children: [
							isWatering && /* @__PURE__ */ jsxs("div", {
								className: "absolute inset-x-0 top-0 flex justify-center gap-4 text-blue-400 animate-bounce pointer-events-none z-20",
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "text-2xl",
										children: "💧"
									}),
									/* @__PURE__ */ jsx("span", {
										className: "text-3xl mt-4",
										children: "💧"
									}),
									/* @__PURE__ */ jsx("span", {
										className: "text-xl",
										children: "💧"
									}),
									/* @__PURE__ */ jsx("span", {
										className: "text-2xl mt-2",
										children: "💧"
									})
								]
							}),
							isFertilizing && /* @__PURE__ */ jsxs("div", {
								className: "absolute inset-x-0 top-10 flex justify-center gap-6 text-amber-500 animate-pulse pointer-events-none z-20",
								children: [
									/* @__PURE__ */ jsx("span", {
										className: "text-2xl",
										children: "✨"
									}),
									/* @__PURE__ */ jsx("span", {
										className: "text-3xl",
										children: "🌱"
									}),
									/* @__PURE__ */ jsx("span", {
										className: "text-2xl",
										children: "✨"
									})
								]
							}),
							floatingCoins.map((fc) => /* @__PURE__ */ jsxs("div", {
								style: {
									left: `${fc.x}%`,
									top: `${fc.y}%`
								},
								className: "absolute flex items-center gap-1.5 -translate-x-1/2 -translate-y-6 pointer-events-none z-30 transition-all duration-1000 ease-out animate-fade-out",
								children: [/* @__PURE__ */ jsx("img", {
									src: "/assets/AI/ecolink-coin.png",
									alt: "EcoLink Coin",
									className: "size-7 object-contain drop-shadow-md animate-bounce"
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-base font-extrabold text-amber-800 drop-shadow-xs",
									children: ["+", fc.amount]
								})]
							}, fc.id)),
							/* @__PURE__ */ jsxs("svg", {
								viewBox: "0 0 520 520",
								className: "size-full select-none transition-transform duration-500 hover:scale-[1.02]",
								"aria-label": "Cây cổ thụ EcoLink phong cách hình ảnh mẫu",
								children: [
									/* @__PURE__ */ jsxs("defs", { children: [
										/* @__PURE__ */ jsx("filter", {
											id: "oak-shadow",
											x: "-15%",
											y: "-15%",
											width: "130%",
											height: "130%",
											children: /* @__PURE__ */ jsx("feDropShadow", {
												dx: "0",
												dy: "5",
												stdDeviation: "6",
												floodColor: "#013812",
												floodOpacity: "0.25"
											})
										}),
										/* @__PURE__ */ jsx("filter", {
											id: "fruit-drop",
											x: "-20%",
											y: "-20%",
											width: "140%",
											height: "140%",
											children: /* @__PURE__ */ jsx("feDropShadow", {
												dx: "0",
												dy: "3",
												stdDeviation: "3",
												floodColor: "#b91c1c",
												floodOpacity: "0.35"
											})
										}),
										/* @__PURE__ */ jsxs("linearGradient", {
											id: "oak-wood",
											x1: "0",
											y1: "0",
											x2: "1",
											y2: "0",
											children: [
												/* @__PURE__ */ jsx("stop", {
													offset: "0%",
													stopColor: "#45240c"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "22%",
													stopColor: "#693714"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "60%",
													stopColor: "#8c4e1f"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "85%",
													stopColor: "#a7632b"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "100%",
													stopColor: "#5a2e0f"
												})
											]
										}),
										/* @__PURE__ */ jsxs("linearGradient", {
											id: "branch-light",
											x1: "0",
											y1: "0",
											x2: "0",
											y2: "1",
											children: [
												/* @__PURE__ */ jsx("stop", {
													offset: "0%",
													stopColor: "#a7632b"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "40%",
													stopColor: "#84481c"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "100%",
													stopColor: "#3d1e08"
												})
											]
										}),
										/* @__PURE__ */ jsxs("linearGradient", {
											id: "oak-leaf-dark",
											x1: "0",
											y1: "0",
											x2: "0",
											y2: "1",
											children: [/* @__PURE__ */ jsx("stop", {
												offset: "0%",
												stopColor: "#086e24"
											}), /* @__PURE__ */ jsx("stop", {
												offset: "100%",
												stopColor: "#014413"
											})]
										}),
										/* @__PURE__ */ jsxs("linearGradient", {
											id: "oak-leaf-mid",
											x1: "0",
											y1: "0",
											x2: "0",
											y2: "1",
											children: [/* @__PURE__ */ jsx("stop", {
												offset: "0%",
												stopColor: "#32bf32"
											}), /* @__PURE__ */ jsx("stop", {
												offset: "100%",
												stopColor: "#158f21"
											})]
										}),
										/* @__PURE__ */ jsxs("linearGradient", {
											id: "oak-leaf-sun",
											x1: "0",
											y1: "0",
											x2: "0",
											y2: "1",
											children: [
												/* @__PURE__ */ jsx("stop", {
													offset: "0%",
													stopColor: "#b4f427"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "50%",
													stopColor: "#8bee16"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "100%",
													stopColor: "#3dbf27"
												})
											]
										}),
										/* @__PURE__ */ jsxs("radialGradient", {
											id: "oak-fruit",
											cx: "35%",
											cy: "30%",
											r: "65%",
											children: [
												/* @__PURE__ */ jsx("stop", {
													offset: "0%",
													stopColor: "#fca5a5"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "30%",
													stopColor: "#ef4444"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "80%",
													stopColor: "#b91c1c"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "100%",
													stopColor: "#7f1d1d"
												})
											]
										}),
										/* @__PURE__ */ jsxs("radialGradient", {
											id: "soil-mound",
											cx: "50%",
											cy: "30%",
											r: "70%",
											children: [
												/* @__PURE__ */ jsx("stop", {
													offset: "0%",
													stopColor: "#804d24"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "60%",
													stopColor: "#5c3417"
												}),
												/* @__PURE__ */ jsx("stop", {
													offset: "100%",
													stopColor: "#331908"
												})
											]
										}),
										/* @__PURE__ */ jsxs("linearGradient", {
											id: "seed-stem-grad",
											x1: "0",
											y1: "1",
											x2: "0",
											y2: "0",
											children: [/* @__PURE__ */ jsx("stop", {
												offset: "0%",
												stopColor: "#4d6628"
											}), /* @__PURE__ */ jsx("stop", {
												offset: "100%",
												stopColor: "#648535"
											})]
										})
									] }),
									/* @__PURE__ */ jsx("style", { children: `
                @keyframes gentle-leaf-sway {
                  0%, 100% { transform: rotate(0deg); }
                  50% { transform: rotate(1deg); }
                }
                @keyframes fruit-bounce {
                  0%, 100% { transform: translateY(0); }
                  50% { transform: translateY(-4px); }
                }
                .canopy-animated {
                  transform-origin: 260px 380px;
                  animation: gentle-leaf-sway 5s ease-in-out infinite;
                }
                .fruit-bouncing {
                  animation: fruit-bounce 2s ease-in-out infinite;
                  cursor: pointer;
                }
              ` }),
									/* @__PURE__ */ jsx("ellipse", {
										cx: "260",
										cy: "470",
										rx: "145",
										ry: "18",
										fill: "#e2ecc8"
									}),
									/* @__PURE__ */ jsx("ellipse", {
										cx: "260",
										cy: "469",
										rx: "115",
										ry: "12",
										fill: "#d2dfb0",
										opacity: "0.6"
									}),
									tree.isDead && /* @__PURE__ */ jsxs("g", {
										className: "transition-all duration-700",
										children: [
											/* @__PURE__ */ jsx("path", {
												d: "M 220 468 L 200 472 L 180 470 M 270 466 L 290 472 L 315 470 M 255 464 L 250 474",
												stroke: "#713f12",
												strokeWidth: "2",
												strokeLinecap: "round",
												fill: "none",
												opacity: "0.6"
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M 180 464\r\n                         C 200 452 222 430 234 385\r\n                         C 238 340 240 312 235 292\r\n                         C 208 268 168 252 128 242\r\n                         C 108 237 92 234 78 232\r\n                         C 102 240 132 250 156 262\r\n                         C 182 275 212 292 232 312\r\n                         C 228 275 222 240 210 200\r\n                         C 202 175 188 152 172 135\r\n                         C 182 150 198 178 208 210\r\n                         C 218 242 224 274 232 296\r\n                         C 236 260 242 218 244 172\r\n                         C 250 192 252 228 250 268\r\n                         C 258 244 276 212 302 178\r\n                         C 294 200 280 234 266 265\r\n                         C 280 282 312 268 354 250\r\n                         C 386 240 412 236 432 232\r\n                         C 414 240 390 248 364 260\r\n                         C 324 278 288 300 276 320\r\n                         C 282 352 284 386 290 426\r\n                         C 298 442 316 454 334 464\r\n                         C 310 460 294 454 285 445\r\n                         C 280 458 272 466 260 466\r\n                         C 252 462 248 452 244 446\r\n                         C 238 454 230 464 216 466\r\n                         C 205 466 195 464 180 464 Z",
														fill: "#4a372c"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 180 464 C 200 452 222 430 234 385 C 238 340 240 312 235 292 C 208 268 168 252 128 242 C 108 237 92 234 78 232 C 102 239 132 249 156 260 C 182 275 212 292 232 312 C 228 275 222 240 210 200 C 202 175 188 152 172 135 C 178 147 190 170 198 198 C 208 240 216 294 228 335 C 224 380 214 425 180 464 Z",
														fill: "#2b1d16",
														opacity: "0.9"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 232 452 Q 244 405 244 355 Q 244 320 242 295",
														stroke: "#1c120c",
														strokeWidth: "2.5",
														fill: "none",
														opacity: "0.7"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 252 456 Q 256 410 254 360 Q 252 325 250 290",
														stroke: "#634c3e",
														strokeWidth: "2",
														fill: "none",
														opacity: "0.6"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 172 135 Q 150 110 135 95 M 172 135 Q 185 115 190 98",
														stroke: "#4a372c",
														strokeWidth: "5",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 244 172 Q 238 135 230 110 M 244 172 Q 255 140 262 115",
														stroke: "#4a372c",
														strokeWidth: "5",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 302 178 Q 320 145 335 125 M 302 178 Q 295 150 290 130",
														stroke: "#4a372c",
														strokeWidth: "5",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 78 232 Q 60 225 45 228",
														stroke: "#4a372c",
														strokeWidth: "5",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 432 232 Q 450 225 465 228",
														stroke: "#4a372c",
														strokeWidth: "5",
														strokeLinecap: "round",
														fill: "none"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												fill: "#92400e",
												stroke: "#451a03",
												strokeWidth: "1",
												children: [
													/* @__PURE__ */ jsx("path", { d: "M 135 95 C 130 90 120 98 135 95" }),
													/* @__PURE__ */ jsx("path", { d: "M 230 110 C 225 105 215 112 230 110" }),
													/* @__PURE__ */ jsx("path", { d: "M 335 125 C 340 120 350 128 335 125" }),
													/* @__PURE__ */ jsx("ellipse", {
														cx: "205",
														cy: "466",
														rx: "8",
														ry: "4",
														transform: "rotate(-15, 205, 466)",
														fill: "#78350f"
													}),
													/* @__PURE__ */ jsx("ellipse", {
														cx: "305",
														cy: "468",
														rx: "9",
														ry: "3.5",
														transform: "rotate(25, 305, 468)",
														fill: "#78350f"
													}),
													/* @__PURE__ */ jsx("ellipse", {
														cx: "240",
														cy: "472",
														rx: "7",
														ry: "3",
														transform: "rotate(-5, 240, 472)",
														fill: "#92400e"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												className: "animate-bounce",
												transform: "translate(260, 240)",
												children: [/* @__PURE__ */ jsx("rect", {
													x: "-85",
													y: "-22",
													width: "170",
													height: "44",
													rx: "22",
													fill: "#ffffff",
													filter: "url(#oak-shadow)",
													stroke: "#ef4444",
													strokeWidth: "2"
												}), /* @__PURE__ */ jsx("text", {
													x: "0",
													y: "6",
													textAnchor: "middle",
													fontSize: "13",
													fontWeight: "bold",
													fill: "#b91c1c",
													children: "🥀 Cây đã chết do cạn nước!"
												})]
											})
										]
									}),
									!tree.isDead && tree.stage === "seed" && /* @__PURE__ */ jsxs("g", {
										className: "transition-all duration-700",
										transform: "translate(260, 470) scale(0.30) translate(-260, -470)",
										children: [
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [/* @__PURE__ */ jsx("path", {
													d: "M 175 470\r\n                         C 175 428 212 414 260 414\r\n                         C 308 414 345 428 345 470\r\n                         C 345 478 175 478 175 470 Z",
													fill: "url(#soil-mound)"
												}), /* @__PURE__ */ jsx("ellipse", {
													cx: "260",
													cy: "425",
													rx: "55",
													ry: "10",
													fill: "#8c582d",
													opacity: "0.4"
												})]
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M 260 436 C 262 390 258 350 256 305",
														stroke: "url(#seed-stem-grad)",
														strokeWidth: "15",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 256 305 Q 248 280 235 260",
														stroke: "url(#seed-stem-grad)",
														strokeWidth: "11",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 256 305 Q 268 288 280 275",
														stroke: "url(#seed-stem-grad)",
														strokeWidth: "11",
														strokeLinecap: "round",
														fill: "none"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [/* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("path", {
													d: "M 235 260\r\n                           C 185 245 110 185 118 100\r\n                           C 122 80 145 85 185 115\r\n                           C 235 155 250 220 235 260 Z",
													fill: "#78ba28",
													stroke: "#314f17",
													strokeWidth: "2.8"
												}), /* @__PURE__ */ jsx("path", {
													d: "M 235 260 Q 170 175 118 100",
													stroke: "#314f17",
													strokeWidth: "5",
													strokeLinecap: "round",
													fill: "none"
												})] }), /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("path", {
													d: "M 280 275\r\n                           C 310 215 375 195 440 235\r\n                           C 455 245 445 265 395 305\r\n                           C 345 345 295 315 280 275 Z",
													fill: "#78ba28",
													stroke: "#314f17",
													strokeWidth: "2.8"
												}), /* @__PURE__ */ jsx("path", {
													d: "M 280 275 Q 365 245 440 235",
													stroke: "#314f17",
													strokeWidth: "5",
													strokeLinecap: "round",
													fill: "none"
												})] })]
											})
										]
									}),
									!tree.isDead && tree.stage === "sprout" && /* @__PURE__ */ jsxs("g", {
										className: "transition-all duration-700",
										children: [
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M 165 474 C 175 456 205 450 225 458 C 245 446 275 444 295 452 C 315 446 340 452 355 462 C 368 466 375 472 365 478 C 340 482 190 482 165 474 Z",
														fill: "#5c3d31"
													}),
													/* @__PURE__ */ jsx("ellipse", {
														cx: "150",
														cy: "472",
														rx: "6",
														ry: "3.5",
														fill: "#422920"
													}),
													/* @__PURE__ */ jsx("ellipse", {
														cx: "370",
														cy: "474",
														rx: "5",
														ry: "3",
														fill: "#422920"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M 235 468 C 242 455 248 440 252 415 M 285 468 C 278 455 272 440 268 415",
														stroke: "url(#oak-wood)",
														strokeWidth: "5",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 246 466\r\n                         C 252 435 250 385 252 345\r\n                         C 246 320 230 290 214 260\r\n                         C 202 238 190 220 182 205\r\n                         C 188 215 204 238 218 262\r\n                         C 230 284 246 312 254 330\r\n                         C 256 310 260 270 264 225\r\n                         C 268 250 268 290 266 325\r\n                         C 274 305 288 280 305 255\r\n                         C 316 238 325 220 330 205\r\n                         C 324 218 312 240 298 265\r\n                         C 285 288 274 315 268 340\r\n                         C 270 385 268 435 274 466 Z",
														fill: "url(#oak-wood)"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 246 466\r\n                         C 252 435 250 385 252 345\r\n                         C 246 320 230 290 214 260\r\n                         C 202 238 190 220 182 205\r\n                         C 185 212 195 230 206 250\r\n                         C 220 275 236 305 246 330\r\n                         C 248 375 248 425 246 466 Z",
														fill: "#331603",
														opacity: "0.88"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 240 325 C 220 308 195 300 172 292",
														stroke: "url(#branch-light)",
														strokeWidth: "3.8",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 214 260 C 200 235 188 215 178 195",
														stroke: "url(#branch-light)",
														strokeWidth: "3.2",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 260 325 C 262 285 264 250 268 218",
														stroke: "url(#branch-light)",
														strokeWidth: "3.5",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 278 285 C 298 255 315 230 328 200",
														stroke: "url(#branch-light)",
														strokeWidth: "3.2",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 270 320 C 295 305 320 298 345 292",
														stroke: "url(#branch-light)",
														strokeWidth: "3.8",
														strokeLinecap: "round",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 256 455 C 258 405 256 360 258 325",
														stroke: "#ba6e2b",
														strokeWidth: "1.8",
														strokeLinecap: "round",
														fill: "none",
														opacity: "0.8"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("g", {
														transform: "translate(178, 195) rotate(-28)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z",
															fill: "#70c448",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(202, 238) rotate(-18)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -8 -8 -10 -20 0 -28 C 10 -20 8 -8 0 0 Z",
															fill: "#78c850",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(172, 292) rotate(-68)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z",
															fill: "#70c448",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(198, 312) rotate(-80)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -7 -7 -9 -18 0 -25 C 9 -18 7 -7 0 0 Z",
															fill: "#78c850",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(268, 218) rotate(4)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z",
															fill: "#8bee16",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(262, 268) rotate(28)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -8 -8 -10 -20 0 -28 C 10 -20 8 -8 0 0 Z",
															fill: "#70c448",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(328, 200) rotate(22)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z",
															fill: "#70c448",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(305, 240) rotate(16)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -8 -8 -10 -20 0 -28 C 10 -20 8 -8 0 0 Z",
															fill: "#78c850",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(345, 292) rotate(58)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -9 -9 -11 -22 0 -30 C 11 -22 9 -9 0 0 Z",
															fill: "#70c448",
															stroke: "#489441",
															strokeWidth: "1"
														})
													}),
													/* @__PURE__ */ jsx("g", {
														transform: "translate(320, 312) rotate(68)",
														children: /* @__PURE__ */ jsx("path", {
															d: "M 0 0 C -7 -7 -9 -18 0 -25 C 9 -18 7 -7 0 0 Z",
															fill: "#70c448",
															stroke: "#489441",
															strokeWidth: "1"
														})
													})
												]
											})
										]
									}),
									!tree.isDead && tree.stage === "sapling" && /* @__PURE__ */ jsxs("g", {
										className: "transition-all duration-700",
										transform: "translate(260, 470) scale(0.66) translate(-260, -470)",
										children: [
											/* @__PURE__ */ jsx("g", {
												filter: "url(#oak-shadow)",
												children: /* @__PURE__ */ jsx("path", {
													d: "M170 120 C140 70 200 40 260 40 C320 40 380 70 350 120 C420 130 450 200 410 250 C460 280 440 340 380 340 C350 340 320 310 300 290 C260 300 210 290 190 280 C150 320 100 320 80 270 C50 240 60 170 110 150 C95 115 130 85 170 120 Z",
													fill: "url(#oak-leaf-dark)"
												})
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M 180 464\r\n                         C 200 452 222 430 234 385\r\n                         C 238 340 240 312 235 292\r\n                         C 208 268 168 252 128 242\r\n                         C 108 237 92 234 78 232\r\n                         C 102 240 132 250 156 262\r\n                         C 182 275 212 292 232 312\r\n                         C 228 275 222 240 210 200\r\n                         C 202 175 188 152 172 135\r\n                         C 182 150 198 178 208 210\r\n                         C 218 242 224 274 232 296\r\n                         C 236 260 242 218 244 172\r\n                         C 250 192 252 228 250 268\r\n                         C 258 244 276 212 302 178\r\n                         C 294 200 280 234 266 265\r\n                         C 280 282 312 268 354 250\r\n                         C 386 240 412 236 432 232\r\n                         C 414 240 390 248 364 260\r\n                         C 324 278 288 300 276 320\r\n                         C 282 352 284 386 290 426\r\n                         C 298 442 316 454 334 464\r\n                         C 310 460 294 454 285 445\r\n                         C 280 458 272 466 260 466\r\n                         C 252 462 248 452 244 446\r\n                         C 238 454 230 464 216 466\r\n                         C 205 466 195 464 180 464 Z",
														fill: "url(#oak-wood)"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 180 464 C 200 452 222 430 234 385 C 238 340 240 312 235 292 C 208 268 168 252 128 242 C 108 237 92 234 78 232 C 102 239 132 249 156 260 C 182 275 212 292 232 312 C 228 275 222 240 210 200 C 202 175 188 152 172 135 C 178 147 190 170 198 198 C 208 240 216 294 228 335 C 224 380 214 425 180 464 Z",
														fill: "#331603",
														opacity: "0.88"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 250 268 C 258 244 276 212 302 178 C 295 198 282 230 268 262 C 280 282 312 268 354 250 C 386 240 412 236 432 232 C 410 239 382 248 350 258 C 316 274 285 296 276 320 C 282 352 284 386 290 426 C 298 442 316 454 334 464 C 308 458 290 445 284 425 C 278 385 274 345 264 315 C 256 300 252 282 250 268 Z",
														fill: "#a15822",
														opacity: "0.88"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 232 452 Q 244 405 244 355 Q 244 320 242 295",
														stroke: "#1f0c01",
														strokeWidth: "2.5",
														fill: "none",
														opacity: "0.65"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 252 456 Q 256 410 254 360 Q 252 325 250 290",
														stroke: "#68320c",
														strokeWidth: "2.2",
														fill: "none",
														opacity: "0.85"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 272 458 Q 268 415 264 370 Q 262 335 262 305",
														stroke: "#ba6e2b",
														strokeWidth: "2",
														fill: "none",
														opacity: "0.8"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsxs("g", {
														id: "clump-bottom-left-mini",
														children: [/* @__PURE__ */ jsx("path", {
															d: "M75 250 C55 245 40 225 50 205 C55 190 70 185 85 190 C95 175 120 170 140 180 C160 170 185 180 195 200 C205 215 195 235 180 245 C190 260 175 280 155 280 C135 285 115 275 105 265 C95 275 75 270 75 250 Z",
															fill: "url(#oak-leaf-mid)"
														}), /* @__PURE__ */ jsx("path", {
															d: "M50 205 C60 190 75 185 90 192 C100 175 125 170 145 180 C165 172 188 182 195 202 C185 190 165 185 145 192 C125 185 100 188 88 202 C75 198 60 202 50 205 Z",
															fill: "url(#oak-leaf-sun)"
														})]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-bottom-right-mini",
														children: [/* @__PURE__ */ jsx("path", {
															d: "M445 250 C465 245 480 225 470 205 C465 190 450 185 435 190 C425 175 400 170 380 180 C360 170 335 180 325 200 C315 215 325 235 340 245 C330 260 345 280 365 280 C385 285 405 275 415 265 C425 275 445 270 445 250 Z",
															fill: "url(#oak-leaf-mid)"
														}), /* @__PURE__ */ jsx("path", {
															d: "M470 205 C460 190 445 185 430 192 C420 175 395 170 375 180 C355 172 332 182 325 202 C335 190 355 185 375 192 C395 185 420 188 432 202 C445 198 460 202 470 205 Z",
															fill: "url(#oak-leaf-sun)"
														})]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-mid-left-mini",
														children: [/* @__PURE__ */ jsx("path", {
															d: "M110 180 C90 170 85 145 100 125 C115 110 135 115 145 125 C160 105 190 100 215 115 C235 105 265 115 270 140 C275 160 260 180 240 185 C245 205 225 225 200 225 C175 225 155 210 145 195 C130 205 115 195 110 180 Z",
															fill: "url(#oak-leaf-mid)"
														}), /* @__PURE__ */ jsx("path", {
															d: "M100 125 C115 110 135 115 148 128 C162 106 192 102 216 116 C236 106 266 116 270 142 C255 125 232 122 215 128 C192 118 165 122 148 138 C138 126 120 122 100 125 Z",
															fill: "url(#oak-leaf-sun)"
														})]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-mid-right-mini",
														children: [/* @__PURE__ */ jsx("path", {
															d: "M410 180 C430 170 435 145 420 125 C405 110 385 115 375 125 C360 105 330 100 305 115 C285 105 255 115 250 140 C245 160 260 180 280 185 C275 205 295 225 320 225 C345 225 365 210 375 195 C390 205 405 195 410 180 Z",
															fill: "url(#oak-leaf-mid)"
														}), /* @__PURE__ */ jsx("path", {
															d: "M420 125 C405 110 385 115 372 128 C358 106 328 102 304 116 C284 106 254 116 250 142 C265 125 288 122 305 128 C328 118 355 122 372 138 C382 126 400 122 420 125 Z",
															fill: "url(#oak-leaf-sun)"
														})]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-crown-top-mini",
														children: [/* @__PURE__ */ jsx("path", {
															d: "M175 105 C155 85 170 55 200 48 C215 30 245 25 265 35 C285 25 315 30 330 50 C355 55 370 85 350 108 C365 125 355 155 330 162 C305 170 280 165 265 150 C245 165 220 170 195 162 C170 155 160 125 175 105 Z",
															fill: "url(#oak-leaf-mid)"
														}), /* @__PURE__ */ jsx("path", {
															d: "M175 105 C165 85 175 55 202 48 C216 30 246 25 265 36 C284 25 314 30 328 50 C354 55 365 85 350 108 C340 85 315 65 265 62 C215 65 190 85 175 105 Z",
															fill: "url(#oak-leaf-sun)"
														})]
													})
												]
											})
										]
									}),
									!tree.isDead && [
										"mature",
										"flowering",
										"fruiting"
									].includes(tree.stage) && /* @__PURE__ */ jsxs("g", {
										className: "canopy-animated transition-all duration-700",
										children: [
											/* @__PURE__ */ jsx("g", {
												id: "deep-background-canopy",
												filter: "url(#oak-shadow)",
												children: /* @__PURE__ */ jsx("path", {
													d: "M170 120 C140 70 200 40 260 40 C320 40 380 70 350 120 C420 130 450 200 410 250 C460 280 440 340 380 340 C350 340 320 310 300 290 C260 300 210 290 190 280 C150 320 100 320 80 270 C50 240 60 170 110 150 C95 115 130 85 170 120 Z",
													fill: "url(#oak-leaf-dark)"
												})
											}),
											/* @__PURE__ */ jsxs("g", {
												id: "oak-trunk-system",
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M 180 464\r\n                         C 200 452 222 430 234 385\r\n                         C 238 340 240 312 235 292\r\n                         C 208 268 168 252 128 242\r\n                         C 108 237 92 234 78 232\r\n                         C 102 240 132 250 156 262\r\n                         C 182 275 212 292 232 312\r\n                         C 228 275 222 240 210 200\r\n                         C 202 175 188 152 172 135\r\n                         C 182 150 198 178 208 210\r\n                         C 218 242 224 274 232 296\r\n                         C 236 260 242 218 244 172\r\n                         C 250 192 252 228 250 268\r\n                         C 258 244 276 212 302 178\r\n                         C 294 200 280 234 266 265\r\n                         C 280 282 312 268 354 250\r\n                         C 386 240 412 236 432 232\r\n                         C 414 240 390 248 364 260\r\n                         C 324 278 288 300 276 320\r\n                         C 282 352 284 386 290 426\r\n                         C 298 442 316 454 334 464\r\n                         C 310 460 294 454 285 445\r\n                         C 280 458 272 466 260 466\r\n                         C 252 462 248 452 244 446\r\n                         C 238 454 230 464 216 466\r\n                         C 205 466 195 464 180 464 Z",
														fill: "url(#oak-wood)"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 180 464\r\n                         C 200 452 222 430 234 385\r\n                         C 238 340 240 312 235 292\r\n                         C 208 268 168 252 128 242\r\n                         C 108 237 92 234 78 232\r\n                         C 102 239 132 249 156 260\r\n                         C 182 275 212 292 232 312\r\n                         C 228 275 222 240 210 200\r\n                         C 202 175 188 152 172 135\r\n                         C 178 147 190 170 198 198\r\n                         C 208 240 216 294 228 335\r\n                         C 224 380 214 425 180 464 Z",
														fill: "#331603",
														opacity: "0.88"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 250 268\r\n                         C 258 244 276 212 302 178\r\n                         C 295 198 282 230 268 262\r\n                         C 280 282 312 268 354 250\r\n                         C 386 240 412 236 432 232\r\n                         C 410 239 382 248 350 258\r\n                         C 316 274 285 296 276 320\r\n                         C 282 352 284 386 290 426\r\n                         C 298 442 316 454 334 464\r\n                         C 308 458 290 445 284 425\r\n                         C 278 385 274 345 264 315\r\n                         C 256 300 252 282 250 268 Z",
														fill: "#a15822",
														opacity: "0.88"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 156 262 C 142 240 130 214 116 192 C 126 202 140 224 152 246 Z",
														fill: "#582a0b"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 354 258 C 372 236 386 210 398 188 C 388 200 374 222 360 244 Z",
														fill: "#844315"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 232 296 C 242 270 250 235 256 205 C 248 230 240 262 234 290 Z",
														fill: "#71360e"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 232 452 Q 244 405 244 355 Q 244 320 242 295",
														stroke: "#1f0c01",
														strokeWidth: "2.5",
														strokeLinecap: "round",
														fill: "none",
														opacity: "0.65"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 252 456 Q 256 410 254 360 Q 252 325 250 290",
														stroke: "#68320c",
														strokeWidth: "2.2",
														strokeLinecap: "round",
														fill: "none",
														opacity: "0.85"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M 272 458 Q 268 415 264 370 Q 262 335 262 305",
														stroke: "#ba6e2b",
														strokeWidth: "2",
														strokeLinecap: "round",
														fill: "none",
														opacity: "0.8"
													})
												]
											}),
											/* @__PURE__ */ jsxs("g", {
												id: "scalloped-foliage-clusters",
												filter: "url(#oak-shadow)",
												children: [
													/* @__PURE__ */ jsxs("g", {
														id: "clump-bottom-left",
														children: [
															/* @__PURE__ */ jsx("path", {
																d: "M75 250 C55 245 40 225 50 205 C55 190 70 185 85 190 C95 175 120 170 140 180 C160 170 185 180 195 200 C205 215 195 235 180 245 C190 260 175 280 155 280 C135 285 115 275 105 265 C95 275 75 270 75 250 Z",
																fill: "url(#oak-leaf-mid)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M50 205 C60 190 75 185 90 192 C100 175 125 170 145 180 C165 172 188 182 195 202 C185 190 165 185 145 192 C125 185 100 188 88 202 C75 198 60 202 50 205 Z",
																fill: "url(#oak-leaf-sun)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M95 210 Q105 205 115 210 M140 215 Q150 208 160 215",
																stroke: "#b4f427",
																strokeWidth: "2.5",
																strokeLinecap: "round",
																fill: "none"
															})
														]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-bottom-right",
														children: [
															/* @__PURE__ */ jsx("path", {
																d: "M445 250 C465 245 480 225 470 205 C465 190 450 185 435 190 C425 175 400 170 380 180 C360 170 335 180 325 200 C315 215 325 235 340 245 C330 260 345 280 365 280 C385 285 405 275 415 265 C425 275 445 270 445 250 Z",
																fill: "url(#oak-leaf-mid)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M470 205 C460 190 445 185 430 192 C420 175 395 170 375 180 C355 172 332 182 325 202 C335 190 355 185 375 192 C395 185 420 188 432 202 C445 198 460 202 470 205 Z",
																fill: "url(#oak-leaf-sun)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M360 215 Q370 208 380 215 M405 210 Q415 205 425 210",
																stroke: "#b4f427",
																strokeWidth: "2.5",
																strokeLinecap: "round",
																fill: "none"
															})
														]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-mid-left",
														children: [
															/* @__PURE__ */ jsx("path", {
																d: "M110 180 C90 170 85 145 100 125 C115 110 135 115 145 125 C160 105 190 100 215 115 C235 105 265 115 270 140 C275 160 260 180 240 185 C245 205 225 225 200 225 C175 225 155 210 145 195 C130 205 115 195 110 180 Z",
																fill: "url(#oak-leaf-mid)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M100 125 C115 110 135 115 148 128 C162 106 192 102 216 116 C236 106 266 116 270 142 C255 125 232 122 215 128 C192 118 165 122 148 138 C138 126 120 122 100 125 Z",
																fill: "url(#oak-leaf-sun)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M140 145 Q152 138 165 145 M190 140 Q205 132 220 140",
																stroke: "#b4f427",
																strokeWidth: "3",
																strokeLinecap: "round",
																fill: "none"
															})
														]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-mid-right",
														children: [
															/* @__PURE__ */ jsx("path", {
																d: "M410 180 C430 170 435 145 420 125 C405 110 385 115 375 125 C360 105 330 100 305 115 C285 105 255 115 250 140 C245 160 260 180 280 185 C275 205 295 225 320 225 C345 225 365 210 375 195 C390 205 405 195 410 180 Z",
																fill: "url(#oak-leaf-mid)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M420 125 C405 110 385 115 372 128 C358 106 328 102 304 116 C284 106 254 116 250 142 C265 125 288 122 305 128 C328 118 355 122 372 138 C382 126 400 122 420 125 Z",
																fill: "url(#oak-leaf-sun)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M300 140 Q315 132 330 140 M355 145 Q368 138 380 145",
																stroke: "#b4f427",
																strokeWidth: "3",
																strokeLinecap: "round",
																fill: "none"
															})
														]
													}),
													/* @__PURE__ */ jsxs("g", {
														id: "clump-crown-top",
														children: [
															/* @__PURE__ */ jsx("path", {
																d: "M175 105 C155 85 170 55 200 48 C215 30 245 25 265 35 C285 25 315 30 330 50 C355 55 370 85 350 108 C365 125 355 155 330 162 C305 170 280 165 265 150 C245 165 220 170 195 162 C170 155 160 125 175 105 Z",
																fill: "url(#oak-leaf-mid)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M175 105 C165 85 175 55 202 48 C216 30 246 25 265 36 C284 25 314 30 328 50 C354 55 365 85 350 108 C340 85 315 65 265 62 C215 65 190 85 175 105 Z",
																fill: "url(#oak-leaf-sun)"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M210 75 Q225 65 240 75 M275 72 Q290 64 305 72",
																stroke: "#b4f427",
																strokeWidth: "3",
																strokeLinecap: "round",
																fill: "none"
															}),
															/* @__PURE__ */ jsx("path", {
																d: "M245 100 Q260 90 275 100 M210 115 Q225 106 240 115",
																stroke: "#b4f427",
																strokeWidth: "3",
																strokeLinecap: "round",
																fill: "none"
															})
														]
													})
												]
											}),
											tree.stage === "flowering" && /* @__PURE__ */ jsx("g", {
												className: "animate-pulse",
												children: [
													[130, 220],
													[390, 220],
													[170, 150],
													[350, 150],
													[260, 90],
													[210, 80],
													[310, 80],
													[220, 230],
													[300, 230]
												].map(([fx, fy], idx) => /* @__PURE__ */ jsxs("g", {
													transform: `translate(${fx}, ${fy})`,
													children: [
														/* @__PURE__ */ jsx("circle", {
															cx: "0",
															cy: "-6",
															r: "5.5",
															fill: "#ffffff"
														}),
														/* @__PURE__ */ jsx("circle", {
															cx: "0",
															cy: "6",
															r: "5.5",
															fill: "#ffffff"
														}),
														/* @__PURE__ */ jsx("circle", {
															cx: "-6",
															cy: "0",
															r: "5.5",
															fill: "#ffffff"
														}),
														/* @__PURE__ */ jsx("circle", {
															cx: "6",
															cy: "0",
															r: "5.5",
															fill: "#ffffff"
														}),
														/* @__PURE__ */ jsx("circle", {
															cx: "-4",
															cy: "-4",
															r: "5",
															fill: "#fce7f3"
														}),
														/* @__PURE__ */ jsx("circle", {
															cx: "4",
															cy: "4",
															r: "5",
															fill: "#fce7f3"
														}),
														/* @__PURE__ */ jsx("circle", {
															cx: "0",
															cy: "0",
															r: "4",
															fill: "#facc15"
														})
													]
												}, idx))
											}),
											tree.stage === "fruiting" && tree.fruitsCount > 0 && /* @__PURE__ */ jsx("g", { children: [
												[140, 235],
												[380, 235],
												[185, 160],
												[335, 160],
												[260, 110]
											].slice(0, tree.fruitsCount).map(([rx, ry], idx) => /* @__PURE__ */ jsxs("g", {
												onClick: handleHarvest,
												className: "fruit-bouncing",
												transform: `translate(${rx}, ${ry})`,
												filter: "url(#fruit-drop)",
												children: [
													/* @__PURE__ */ jsx("path", {
														d: "M0 -14 Q4 -20 10 -18",
														stroke: "#14532d",
														strokeWidth: "2.5",
														fill: "none"
													}),
													/* @__PURE__ */ jsx("path", {
														d: "M6 -19 C12 -23 16 -18 10 -17",
														fill: "#4ade80"
													}),
													/* @__PURE__ */ jsx("circle", {
														cx: "0",
														cy: "0",
														r: "13",
														fill: "url(#oak-fruit)"
													}),
													/* @__PURE__ */ jsx("ellipse", {
														cx: "-4",
														cy: "-4",
														rx: "4",
														ry: "2",
														fill: "#ffffff",
														opacity: "0.8",
														transform: "rotate(-30, -4, -4)"
													}),
													/* @__PURE__ */ jsx("circle", {
														cx: "3",
														cy: "5",
														r: "1.5",
														fill: "#ffffff",
														opacity: "0.4"
													})
												]
											}, idx)) })
										]
									})
								]
							})
						]
					}),
					/* @__PURE__ */ jsx("div", {
						className: "flex w-full flex-wrap items-center justify-center gap-3 pt-2 border-t border-line-soft",
						children: tree.isDead ? /* @__PURE__ */ jsxs("button", {
							type: "button",
							onClick: handleReplant,
							className: "flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-brand-deep active:scale-95 animate-pulse",
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-base",
								children: "🌱"
							}), /* @__PURE__ */ jsx("span", { children: "Cây đã chết — Gieo hạt nuôi lại từ đầu" })]
						}) : /* @__PURE__ */ jsxs(Fragment, { children: [
							/* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: handleWater,
								disabled: isWatering,
								className: "flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-[background-color,transform] hover:bg-blue-700 active:scale-95 disabled:opacity-50",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-base",
									children: "🚰"
								}), /* @__PURE__ */ jsx("span", { children: "Tưới nước (+30%)" })]
							}),
							/* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: handleFertilize,
								disabled: isFertilizing,
								className: "flex items-center gap-2 rounded-2xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white shadow-xs transition-[background-color,transform] hover:bg-emerald-800 active:scale-95 disabled:opacity-50",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-base",
									children: "🧪"
								}), /* @__PURE__ */ jsx("span", { children: "Bón phân (+25 EXP)" })]
							}),
							tree.stage === "fruiting" && tree.harvestReady && /* @__PURE__ */ jsxs("button", {
								type: "button",
								onClick: handleHarvest,
								className: "flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow-md animate-bounce hover:bg-amber-600 active:scale-95",
								children: [/* @__PURE__ */ jsx("span", {
									className: "text-base",
									children: "🍎"
								}), /* @__PURE__ */ jsx("span", { children: "Thu hoạch quả (+25 xu)" })]
							})
						] })
					})
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-6",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "rounded-3xl border border-line bg-white p-6 shadow-xs",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-lg font-bold text-ink",
							children: "Chỉ số sinh tồn của cây"
						}),
						/* @__PURE__ */ jsx("p", {
							className: "mt-1 text-xs text-muted",
							children: "Cây cần đủ độ ẩm để sống. Nếu nước về 0%, cây sẽ héo khô và ngừng tăng trưởng."
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-5 flex flex-col gap-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between text-xs font-bold",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "flex items-center gap-1.5 text-blue-700",
									children: [/* @__PURE__ */ jsx("span", { children: "💧" }), " Lượng nước duy trì:"]
								}), /* @__PURE__ */ jsxs("span", {
									className: tree.water <= 20 ? "text-red-600 font-extrabold" : "text-blue-900",
									children: [
										tree.water,
										"% ",
										tree.water <= 20 && "(Báo động khô hạn!)"
									]
								})]
							}), /* @__PURE__ */ jsx("div", {
								className: "h-3 w-full overflow-hidden rounded-full bg-blue-100",
								children: /* @__PURE__ */ jsx("div", {
									className: `h-full transition-all duration-500 ${tree.water <= 20 ? "bg-red-500" : tree.water <= 50 ? "bg-amber-400" : "bg-blue-500"}`,
									style: { width: `${tree.water}%` }
								})
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-5 flex flex-col gap-2",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "flex justify-between text-xs font-bold",
								children: [/* @__PURE__ */ jsxs("span", {
									className: "flex items-center gap-1.5 text-emerald-800",
									children: [/* @__PURE__ */ jsx("span", { children: "🌱" }), " Tiến trình lớn lên:"]
								}), /* @__PURE__ */ jsxs("span", {
									className: "text-emerald-950",
									children: [
										tree.exp,
										" / ",
										tree.maxExp,
										" EXP"
									]
								})]
							}), /* @__PURE__ */ jsx("div", {
								className: "h-3 w-full overflow-hidden rounded-full bg-emerald-100",
								children: /* @__PURE__ */ jsx("div", {
									className: "h-full bg-brand transition-all duration-500",
									style: { width: `${Math.min(100, tree.exp / tree.maxExp * 100)}%` }
								})
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "mt-6 rounded-2xl bg-surface-2 p-4 text-xs",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "font-bold text-ink",
								children: ["Giai đoạn: ", currentStage.name]
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-1 leading-relaxed text-muted",
								children: currentStage.desc
							})]
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "rounded-3xl border border-line bg-white p-6 shadow-xs",
					children: [/* @__PURE__ */ jsx("h3", {
						className: "text-base font-bold text-ink",
						children: "Cơ chế tặng EcoLink Coin"
					}), /* @__PURE__ */ jsxs("div", {
						className: "mt-3.5 flex flex-col gap-3 text-xs leading-relaxed text-body",
						children: [
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ jsx("span", {
									className: "grid size-8 shrink-0 place-items-center rounded-xl bg-blue-100 text-blue-800 font-bold",
									children: "+3"
								}), /* @__PURE__ */ jsx("p", { children: "Mỗi lần tưới nước bổ sung độ ẩm, cây sẽ tặng bạn 3 EcoLink Coin." })]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ jsx("span", {
									className: "grid size-8 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800 font-bold",
									children: "+6"
								}), /* @__PURE__ */ jsx("p", { children: "Mỗi lần bón phân hữu cơ kích thích cây lớn nhanh, bạn nhận 6 EcoLink Coin." })]
							}),
							/* @__PURE__ */ jsxs("div", {
								className: "flex items-center gap-3",
								children: [/* @__PURE__ */ jsx("span", {
									className: "grid size-8 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800 font-bold",
									children: "+25"
								}), /* @__PURE__ */ jsx("p", { children: "Khi cây đơm hoa kết trái, bấm thu hoạch để nhận ngay 25 EcoLink Coin!" })]
							})
						]
					})]
				})]
			})]
		})]
	});
}
//#endregion
//#region src/components/AuthForm.tsx
/** Tài khoản dùng thử. Vai trò lấy từ tên đăng nhập, KHÔNG có ô chọn vai trò:
*  hệ thống thật không ai tự chọn quyền cho mình, vai trò do backend trả về theo
*  tài khoản. Bảng này chỉ để bản demo vào được cả 4 khu vực để xem.
*
*  Mật khẩu kiểm ở `DEMO_PASS` — không kiểm thì ai cũng vào được, có kiểm thì
*  phải nhớ mật khẩu trước khi xem được trang. */
var DEMO = {
	user: {
		role: "user",
		name: "Nguyễn Đức"
	},
	recycler: {
		role: "recycler",
		name: "Cô Ba Thu Gom"
	},
	staff: {
		role: "staff",
		name: "Lê Thu Hà"
	},
	admin: {
		role: "admin",
		name: "Quản trị viên"
	}
};
var DEMO_PASS = "123";
var COPY = {
	login: {
		title: "Đăng nhập",
		body: "Đăng nhập để quản lý lịch thu gom và theo dõi đóng góp xanh của bạn.",
		submit: "Đăng nhập",
		switchText: "Chưa có tài khoản?",
		switchLink: "Đăng ký miễn phí",
		switchTo: "register"
	},
	register: {
		title: "Tạo tài khoản",
		body: "Tham gia cộng đồng sống xanh và tích lũy giá trị từ rác tái chế.",
		submit: "Tạo tài khoản",
		switchText: "Đã có tài khoản?",
		switchLink: "Đăng nhập",
		switchTo: "login"
	}
};
function AuthForm({ mode: initialMode }) {
	const isPopup = isAuthPopup();
	const [mode, setMode] = useState(initialMode);
	const copy = COPY[mode];
	const navigate = useNavigate();
	const [showPassword, setShowPassword] = useState(false);
	const [err, setErr] = useState("");
	const switchMode = (next) => {
		setMode(next);
		setErr("");
		window.history.replaceState(null, "", `/${next}${isPopup ? "?popup=1" : ""}`);
	};
	const submit = (e) => {
		e.preventDefault();
		const data = new FormData(e.currentTarget);
		if (mode === "login") {
			const login = String(data.get("email") ?? "").trim().toLowerCase();
			const pass = String(data.get("password") ?? "");
			if (!DEMO[login] || pass !== DEMO_PASS) {
				setErr("Email hoặc mật khẩu không đúng. Kiểm tra lại rồi thử.");
				return;
			}
			signIn(DEMO[login].name, DEMO[login].role);
			const role = DEMO[login].role;
			if (isPopup && window.opener) {
				try {
					window.opener.postMessage({
						type: "AUTH_SUCCESS",
						role
					}, "*");
				} catch {}
				window.close();
				return;
			}
			navigate(role === "user" ? "/" : ROLE_HOME[role]);
			return;
		}
		const raw = String(data.get("name") || data.get("email") || "EcoLink");
		signIn(raw.includes("@") ? raw.split("@")[0] : raw, "user");
		if (isPopup && window.opener) {
			try {
				window.opener.postMessage({
					type: "AUTH_SUCCESS",
					role: "user"
				}, "*");
			} catch {}
			window.close();
			return;
		}
		navigate("/");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "mx-auto flex w-full max-w-[430px] flex-col",
		children: [isPopup ? /* @__PURE__ */ jsxs("button", {
			type: "button",
			onClick: () => window.close(),
			className: "group mb-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-body transition-colors hover:text-brand-deep",
			children: [/* @__PURE__ */ jsx("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				className: "size-5 transition-transform duration-200 group-hover:-translate-x-0.5",
				children: /* @__PURE__ */ jsx("path", {
					d: "M18 6 6 18M6 6l12 12",
					stroke: "currentColor",
					strokeWidth: "2",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			}), "Đóng cửa sổ"]
		}) : /* @__PURE__ */ jsxs(Link, {
			to: "/",
			"aria-label": "Về trang chủ",
			className: "group mb-5 inline-flex items-center gap-2.5 self-start text-sm font-semibold text-body transition-colors hover:text-brand-deep",
			children: [/* @__PURE__ */ jsx("svg", {
				viewBox: "0 0 24 24",
				fill: "none",
				"aria-hidden": "true",
				className: "size-5 -translate-x-0 transition-transform duration-200 group-hover:-translate-x-1",
				children: /* @__PURE__ */ jsx("path", {
					d: "M20 12H4m0 0 6.5-6.5M4 12l6.5 6.5",
					stroke: "currentColor",
					strokeWidth: "1.9",
					strokeLinecap: "round",
					strokeLinejoin: "round"
				})
			}), "Về trang chủ"]
		}), /* @__PURE__ */ jsxs("div", {
			className: "rounded-none border-0 bg-transparent p-0 shadow-none lg:rounded-3xl lg:border lg:border-line lg:bg-white lg:p-8 lg:shadow-[0_4px_24px_rgba(15,31,21,0.05)]",
			children: [
				/* @__PURE__ */ jsx(Link, {
					to: "/",
					"aria-label": "EcoLink - Trang chủ",
					className: "mx-auto mb-6 block w-fit",
					children: /* @__PURE__ */ jsx("img", {
						src: "/assets/brand/logo1.png",
						alt: "EcoLink",
						className: "h-[66px] w-auto"
					})
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-6 grid grid-cols-2 rounded-xl bg-surface-2 p-1 text-sm font-semibold",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => switchMode("register"),
						className: `rounded-lg py-2 transition-[background-color,color,box-shadow] duration-150 ${mode === "register" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"}`,
						children: "Tạo tài khoản"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => switchMode("login"),
						className: `rounded-lg py-2 transition-[background-color,color,box-shadow] duration-150 ${mode === "login" ? "bg-white text-ink shadow-xs" : "text-muted hover:text-ink"}`,
						children: "Đăng nhập"
					})]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mb-7",
					children: [/* @__PURE__ */ jsx("h1", {
						className: "text-[26px] font-bold tracking-tight text-ink",
						children: copy.title
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-2 text-sm leading-[1.6] text-muted",
						children: copy.body
					})]
				}),
				/* @__PURE__ */ jsxs("form", {
					onSubmit: submit,
					className: "flex flex-col gap-5",
					children: [
						mode === "register" && /* @__PURE__ */ jsx(Field$1, {
							label: "Họ và tên",
							children: /* @__PURE__ */ jsx("input", {
								className: "input",
								name: "name",
								type: "text",
								placeholder: "Nguyễn Văn An",
								autoComplete: "name",
								required: true
							})
						}),
						/* @__PURE__ */ jsx(Field$1, {
							label: "Email",
							children: /* @__PURE__ */ jsx("input", {
								className: "input",
								name: "email",
								type: mode === "login" ? "text" : "email",
								placeholder: mode === "login" ? "Tài khoản" : "ban@ecolink.vn",
								autoComplete: mode === "login" ? "username" : "email",
								required: true
							})
						}),
						/* @__PURE__ */ jsx(Field$1, {
							label: "Mật khẩu",
							children: /* @__PURE__ */ jsxs("span", {
								className: "relative block",
								children: [/* @__PURE__ */ jsx("input", {
									name: "password",
									type: showPassword ? "text" : "password",
									placeholder: mode === "login" ? `Mật khẩu` : "Tối thiểu 8 ký tự",
									minLength: mode === "register" ? 8 : void 0,
									autoComplete: mode === "register" ? "new-password" : "current-password",
									required: true,
									className: "input pr-16"
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setShowPassword((v) => !v),
									className: "absolute inset-y-0 right-0 my-auto h-7 rounded-md px-2.5 text-xs font-semibold text-brand transition-colors hover:text-brand-deep",
									children: showPassword ? "Ẩn" : "Hiện"
								})]
							})
						}),
						mode === "login" && err && /* @__PURE__ */ jsx("p", {
							role: "alert",
							className: "-mt-2 text-[13px] text-warn",
							children: err
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "-mt-1 flex items-center justify-between",
							children: [/* @__PURE__ */ jsxs("label", {
								className: "flex items-center gap-2 text-[13px] text-muted",
								children: [/* @__PURE__ */ jsx("input", {
									type: "checkbox",
									className: "size-4 accent-brand"
								}), "Ghi nhớ đăng nhập"]
							}), mode === "login" && /* @__PURE__ */ jsx(Link, {
								to: "/reset-password",
								className: "text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep",
								children: "Quên mật khẩu?"
							})]
						}),
						/* @__PURE__ */ jsxs("button", {
							type: "submit",
							className: "group mt-1 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-brand text-[15px] font-bold text-white shadow-[0_10px_26px_-10px_rgba(15,31,21,0.38)] transition-[background-color,box-shadow,transform] duration-200 ease-out hover:bg-brand-deep hover:shadow-[0_14px_30px_-10px_rgba(15,31,21,0.42)] active:scale-[0.985]",
							children: [copy.submit, /* @__PURE__ */ jsx("svg", {
								viewBox: "0 0 16 16",
								fill: "none",
								"aria-hidden": "true",
								className: "size-4 transition-transform duration-200 ease-out group-hover:translate-x-1",
								children: /* @__PURE__ */ jsx("path", {
									d: "M2 8h11m0 0-4-4m4 4-4 4",
									stroke: "currentColor",
									strokeWidth: "1.9",
									strokeLinecap: "round",
									strokeLinejoin: "round"
								})
							})]
						})
					]
				}),
				/* @__PURE__ */ jsxs("p", {
					className: "mt-7 text-center text-[13px] text-muted",
					children: [copy.switchText, /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => switchMode(copy.switchTo),
						className: "ml-2 inline-flex h-9 items-center rounded-full bg-brand/10 px-3.5 font-semibold text-brand transition-[background-color,transform] duration-200 ease-out hover:bg-brand/18 active:scale-[0.97]",
						children: copy.switchLink
					})]
				})
			]
		})]
	});
}
function Field$1({ label, children }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
		children: [label, children]
	});
}
//#endregion
//#region src/pages/Login.tsx
function Login() {
	return /* @__PURE__ */ jsx(AuthForm, { mode: "login" });
}
//#endregion
//#region src/pages/Register.tsx
function Register() {
	return /* @__PURE__ */ jsx(AuthForm, { mode: "register" });
}
//#endregion
//#region src/pages/Logout.tsx
function Logout() {
	const session = useSession();
	const navigate = useNavigate();
	const isPopup = isAuthPopup();
	const [done, setDone] = useState(false);
	const handleLogout = () => {
		signOut();
		setDone(true);
		if (isPopup && window.opener) {
			try {
				window.opener.postMessage({ type: "AUTH_LOGOUT" }, "*");
			} catch {}
			setTimeout(() => {
				window.close();
			}, 500);
		} else setTimeout(() => {
			navigate("/");
		}, 500);
	};
	const handleCancel = () => {
		if (isPopup) window.close();
		else navigate(-1);
	};
	return /* @__PURE__ */ jsx("div", {
		className: "flex min-h-dvh flex-col items-center justify-center bg-page p-6 text-center",
		children: /* @__PURE__ */ jsxs("div", {
			className: "w-full max-w-[380px] rounded-2xl border border-line bg-white p-6 shadow-sm",
			children: [/* @__PURE__ */ jsx("img", {
				src: "/assets/brand/logo1.png",
				alt: "EcoLink",
				className: "mx-auto mb-4 h-12 w-auto"
			}), done ? /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("div", {
					className: "mx-auto mb-3 grid size-12 place-items-center rounded-full bg-mint/20 text-brand-deep",
					children: /* @__PURE__ */ jsx("svg", {
						viewBox: "0 0 24 24",
						fill: "none",
						className: "size-6",
						stroke: "currentColor",
						strokeWidth: "2",
						children: /* @__PURE__ */ jsx("path", {
							d: "M20 6 9 17l-5-5",
							strokeLinecap: "round",
							strokeLinejoin: "round"
						})
					})
				}),
				/* @__PURE__ */ jsx("h1", {
					className: "text-lg font-bold text-ink",
					children: "Đã đăng xuất thành công"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-xs text-muted",
					children: "Cửa sổ sẽ tự đóng lại trong giây lát..."
				})
			] }) : /* @__PURE__ */ jsxs("div", { children: [
				/* @__PURE__ */ jsx("h1", {
					className: "text-lg font-bold text-ink",
					children: "Xác nhận đăng xuất"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-2 text-sm text-muted",
					children: session?.name ? `Bạn có chắc chắn muốn đăng xuất tài khoản "${session.name}" không?` : "Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc này?"
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "mt-6 flex items-center justify-center gap-3",
					children: [/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: handleCancel,
						className: "h-10 flex-1 rounded-xl border border-line bg-surface text-sm font-semibold text-body transition-colors hover:bg-surface-2",
						children: "Hủy bỏ"
					}), /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: handleLogout,
						className: "h-10 flex-1 rounded-xl bg-warn text-sm font-semibold text-white shadow-xs transition-colors hover:opacity-90",
						children: "Đăng xuất"
					})]
				})
			] })]
		})
	});
}
//#endregion
//#region src/pages/NotFound.tsx
function NotFound() {
	return /* @__PURE__ */ jsx("div", {
		className: "page grid min-h-[60dvh] place-items-center py-20 text-center",
		children: /* @__PURE__ */ jsxs("div", { children: [
			/* @__PURE__ */ jsx("p", {
				className: "eyebrow",
				children: "LỖI 404"
			}),
			/* @__PURE__ */ jsx("h1", {
				className: "display mt-3 text-4xl",
				children: "Không tìm thấy trang"
			}),
			/* @__PURE__ */ jsx("p", {
				className: "mt-3 text-sm text-body",
				children: "Đường dẫn bạn mở không còn tồn tại trên EcoLink."
			}),
			/* @__PURE__ */ jsx(Link, {
				to: "/",
				className: "btn-primary mt-8",
				children: "Về trang chủ"
			})
		] })
	});
}
//#endregion
//#region src/data/handover.ts
/** Khung giờ dùng chung cho U-07 (User chọn) và R-03 (Recycler chốt).
*  Một danh sách, hai bên dùng — lệch danh sách là sinh lịch không khớp. */
var TIME_SLOTS = [
	"08:00 - 10:00",
	"10:00 - 12:00",
	"13:30 - 15:30",
	"15:30 - 17:30",
	"17:30 - 19:00"
];
var STATUS_LABEL = {
	pending: "Chờ xác nhận",
	accepted: "Đã nhận",
	collected: "Chờ xác nhận bàn giao",
	done: "Hoàn tất",
	cancelled: "Đã huỷ",
	declined: "Bị từ chối",
	broken: "Thu gom bị huỷ"
};
var MY_HANDOVERS = [
	{
		id: "BH-2609-0184",
		recycler: "Cô Ba Thu Gom",
		address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
		date: "28/09/2026",
		slot: TIME_SLOTS[1],
		lines: [{
			wasteId: "carton",
			kg: 15
		}, {
			wasteId: "pet",
			kg: 5
		}],
		status: "accepted"
	},
	{
		id: "BH-2609-0121",
		recycler: "Vựa Minh Khai",
		address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
		date: "21/09/2026",
		slot: TIME_SLOTS[2],
		lines: [{
			wasteId: "aluminum",
			kg: 4
		}, {
			wasteId: "steel",
			kg: 8
		}],
		status: "done",
		actual: [{
			wasteId: "aluminum",
			kg: 4.2
		}, {
			wasteId: "steel",
			kg: 7.6
		}],
		feeRate: FEE_RATE
	},
	{
		id: "BH-2608-0409",
		recycler: "Cô Ba Thu Gom",
		address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
		date: "12/08/2026",
		slot: TIME_SLOTS[4],
		lines: [{
			wasteId: "glass",
			kg: 20
		}],
		status: "done",
		actual: [{
			wasteId: "glass",
			kg: 18
		}],
		feeRate: FEE_RATE
	}
];
/** Hàng chờ của Recycler (R-03). Cùng kiểu `Handover`, khác nguồn dữ liệu. */
var INCOMING = [
	{
		id: "BH-2609-0201",
		recycler: "Chưa có",
		address: "114 Lý Văn Phức, Phường 2, Quận 3",
		date: "30/09/2026",
		slot: TIME_SLOTS[2],
		lines: [{
			wasteId: "carton",
			kg: 30
		}, {
			wasteId: "office-paper",
			kg: 12
		}],
		status: "pending"
	},
	{
		id: "BH-2609-0199",
		recycler: "Chưa có",
		address: "22 Nguyễn Văn Cừ, Phường 5, Quận 5",
		date: "30/09/2026",
		slot: TIME_SLOTS[0],
		lines: [{
			wasteId: "steel",
			kg: 45
		}, {
			wasteId: "aluminum",
			kg: 9
		}],
		status: "pending"
	},
	{
		id: "BH-2609-0184",
		recycler: "Cô Ba Thu Gom",
		address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
		date: "28/09/2026",
		slot: TIME_SLOTS[1],
		lines: [{
			wasteId: "carton",
			kg: 15
		}, {
			wasteId: "pet",
			kg: 5
		}],
		status: "collected"
	},
	{
		id: "BH-2609-0150",
		recycler: "Cô Ba Thu Gom",
		address: "Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1",
		date: "25/09/2026",
		slot: TIME_SLOTS[4],
		lines: [{
			wasteId: "pet",
			kg: 6
		}],
		status: "broken",
		reason: "Xe tải hỏng bơm, ca đêm đông khách nên dời sang ngày mai."
	}
];
/** Các mốc trạng thái trên trang User: dùng nhãn, không dùng mã. */
var TONE = {
	pending: "wait",
	accepted: "todo",
	collected: "todo",
	done: "ok",
	cancelled: "off",
	declined: "off",
	broken: "off"
};
/** Tính tiền một yêu cầu: dùng khối lượng thực nếu có (đã có biên nhận),
*  ngược lại lấy khối lượng User ước tính. */
function calc(h, priceOf) {
	const gross = (h.actual ?? h.lines).reduce((s, l) => s + l.kg * priceOf(l.wasteId), 0);
	const rate = h.feeRate ?? .08;
	const fee = Math.round(gross * rate);
	return {
		gross,
		fee,
		net: gross - fee,
		rate
	};
}
//#endregion
//#region src/pages/account/Profile.tsx
/** SU-01 Xem và cập nhật hồ sơ · SU-03 Thông báo hệ thống.
*
*  Gộp vì cùng một nguồn dữ liệu: hồ sơ và danh sách thông báo đều là "việc
*  của tài khoản này". Tách hai trang thì người dùng phải biết cái nào ở
*  đâu, mà cả hai đều là việc người dùng làm hằng ngày.
*
*  Đổi mật khẩu (SU-02) tách riêng thành `/account/password` vì đó là thao tác
*  có xác thực, không phải chỉnh sửa hồ sơ. */
function Profile() {
	const session = useSession();
	const [name, setName] = useState(session?.name ?? "");
	const [phone, setPhone] = useState("0901 234 567");
	const [area, setArea] = useState("Quận 3, TP. Hồ Chí Minh");
	const [saved, setSaved] = useState(false);
	const [err, setErr] = useState("");
	const submit = (e) => {
		e.preventDefault();
		if (name.trim().length < 2) {
			setErr("Tên hiển thị phải có ít nhất 2 ký tự.");
			setSaved(false);
			return;
		}
		if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
			setErr("Số điện thoại chưa đúng định dạng Việt Nam.");
			setSaved(false);
			return;
		}
		setErr("");
		setSaved(true);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "TÀI KHOẢN",
			title: "Hồ sơ cá nhân",
			body: "Tên hiển thị và thông tin liên hệ. Tên này là thứ người thu gom thấy khi họ tới nhà bạn, nên để tên gọi thật."
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-6 lg:grid-cols-[1.3fr_1fr]",
			children: [/* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				noValidate: true,
				className: "card flex flex-col gap-5 self-start p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx(Field$2, {
						label: "Tên hiển thị",
						hint: "Người thu gom và nhân viên thấy tên này.",
						children: /* @__PURE__ */ jsx("input", {
							className: `input ${err && name.trim().length < 2 ? "border-warn" : ""}`,
							value: name,
							onChange: (e) => {
								setName(e.target.value);
								setSaved(false);
							}
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Số điện thoại",
						hint: "Dùng để báo lịch thu gom và liên hệ khi có khiếu nại.",
						children: /* @__PURE__ */ jsx("input", {
							className: `input tabular-nums ${err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, "")) ? "border-warn" : ""}`,
							inputMode: "tel",
							value: phone,
							onChange: (e) => {
								setPhone(e.target.value);
								setSaved(false);
							}
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Khu vực",
						hint: "Dùng để đề xuất điểm thu gom gần bạn nhất.",
						children: /* @__PURE__ */ jsx("input", {
							className: "input",
							value: area,
							onChange: (e) => setArea(e.target.value)
						})
					}),
					/* @__PURE__ */ jsxs(Field$2, {
						label: "Email",
						children: [/* @__PURE__ */ jsx("input", {
							className: "input",
							value: session ? `${name.split(" ").slice(-1)[0]?.toLowerCase() ?? "ban"}@email.vn` : "ban@email.vn",
							readOnly: true,
							disabled: true
						}), /* @__PURE__ */ jsx("span", {
							className: "text-[12px] font-normal text-muted",
							children: "Email là định danh đăng nhập, không đổi trên trang này."
						})]
					}),
					err && /* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-warn",
						children: err
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Lưu hồ sơ"
						}), saved && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: "Đã lưu hồ sơ."
						})]
					})
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-6",
				children: [/* @__PURE__ */ jsxs("section", {
					className: "card flex flex-col gap-3 p-5",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-base font-bold text-ink",
							children: "Tài khoản của bạn"
						}),
						/* @__PURE__ */ jsx("dl", {
							className: "flex flex-col gap-2 text-sm",
							children: [
								["Vai trò", session?.role === "recycler" ? "Cơ sở thu mua" : session?.role === "staff" ? "Nhân viên" : session?.role === "admin" ? "Quản trị viên" : "Người dân"],
								["Điểm tiêu dùng", fmt(SPEND_POINTS)],
								["Điểm xếp hạng", fmt(RANK_POINTS)],
								["Hạng cây ảo", tierProgress().cur.name],
								["Giao dịch đã hoàn tất", String(MY_HANDOVERS.filter((h) => h.status === "done").length)],
								["Khoản đã nhận", String(FLOWS.filter((f) => f.kind === "payout").length)]
							].map(([k, v]) => /* @__PURE__ */ jsxs("div", {
								className: "flex justify-between gap-3 border-b border-line-soft pb-2",
								children: [/* @__PURE__ */ jsx("dt", {
									className: "text-muted",
									children: k
								}), /* @__PURE__ */ jsx("dd", {
									className: "font-semibold text-ink",
									children: v
								})]
							}, k))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "grid grid-cols-2 gap-3 pt-1",
							children: [/* @__PURE__ */ jsx(Stat$1, {
								label: "Xếp hạng",
								value: `#${LEADERBOARD.findIndex((r) => r.you) + 1}`
							}), /* @__PURE__ */ jsx(Stat$1, {
								label: "Yêu cầu bàn giao",
								value: String(MY_HANDOVERS.length)
							})]
						})
					]
				}), /* @__PURE__ */ jsx(Notifications$1, {})]
			})]
		})]
	});
}
var NOTES = [
	{
		id: "n1",
		text: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
		time: "Hôm nay, 09:34",
		needsAction: true
	},
	{
		id: "n2",
		text: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
		time: "Hôm nay, 11:02",
		needsAction: false
	},
	{
		id: "n3",
		text: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
		time: "Hôm qua, 20:00",
		needsAction: true
	}
];
function Notifications$1() {
	const [read, setRead] = useState({});
	const unread = NOTES.filter((n) => !read[n.id]).length;
	return /* @__PURE__ */ jsxs("section", {
		className: "card flex flex-col gap-4 p-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-baseline justify-between gap-2",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-base font-bold text-ink",
					children: "Thông báo"
				}), /* @__PURE__ */ jsx("span", {
					className: "text-[13px] text-muted",
					children: unread === 0 ? "Đã đọc hết" : `${unread} chưa đọc`
				})]
			}),
			NOTES.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "text-sm text-muted",
				children: "Chưa có thông báo nào."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "flex flex-col gap-2",
				children: NOTES.map((n) => /* @__PURE__ */ jsxs("li", {
					className: `rounded-lg border px-4 py-3 ${read[n.id] ? "border-line-soft bg-surface" : "border-brand/25 bg-brand/6"}`,
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-[13px] leading-5 text-ink",
						children: n.text
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-1 flex items-center gap-2 text-[12px] text-muted",
						children: [n.time, n.needsAction && !read[n.id] && /* @__PURE__ */ jsx(Status$1, {
							tone: "wait",
							children: "Cần xử lý"
						})]
					})]
				}, n.id))
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setRead(Object.fromEntries(NOTES.map((n) => [n.id, true]))),
				disabled: unread === 0,
				className: "btn-ghost h-10 w-fit px-4 text-[13px]",
				children: "Đánh dấu đã đọc tất cả"
			})
		]
	});
}
//#endregion
//#region src/pages/account/Notifications.tsx
var INITIAL_NOTES = [
	{
		id: "n1",
		text: "Cô Ba Thu Gom đã nhận yêu cầu của bạn và chốt khung giờ 10:00 - 12:00.",
		time: "Hôm nay, 09:34",
		needsAction: true
	},
	{
		id: "n2",
		text: "Tiền giao dịch BH-2609-0184 đã chuyển về tài khoản của bạn.",
		time: "Hôm nay, 11:02",
		needsAction: false
	},
	{
		id: "n3",
		text: "Bạn bỏ lỡ điểm danh hôm qua, chuỗi đã tính lại từ đầu.",
		time: "Hôm qua, 20:00",
		needsAction: true
	}
];
function Notifications() {
	const [read, setRead] = useState({});
	const unread = INITIAL_NOTES.filter((n) => !read[n.id]).length;
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "TÀI KHOẢN",
			title: "Thông báo hệ thống",
			body: "Cập nhật tiến độ thu gom, xác nhận giao dịch và tin tức từ EcoLink."
		}), /* @__PURE__ */ jsxs("section", {
			className: "card flex flex-col gap-4 p-5 md:p-6 max-w-2xl",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-baseline justify-between gap-2 border-b border-line-soft pb-3",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-base font-bold text-ink",
						children: "Danh sách thông báo"
					}), /* @__PURE__ */ jsx("span", {
						className: "text-[13px] text-muted",
						children: unread === 0 ? "Đã đọc hết" : `${unread} chưa đọc`
					})]
				}),
				/* @__PURE__ */ jsx("ul", {
					className: "flex flex-col gap-2.5",
					children: INITIAL_NOTES.map((n) => /* @__PURE__ */ jsxs("li", {
						className: `rounded-xl border p-4 transition-colors ${read[n.id] ? "border-line-soft bg-surface" : "border-brand/25 bg-brand/6"}`,
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-sm leading-relaxed text-ink",
							children: n.text
						}), /* @__PURE__ */ jsxs("div", {
							className: "mt-2 flex items-center justify-between gap-2 text-xs text-muted",
							children: [/* @__PURE__ */ jsx("span", { children: n.time }), n.needsAction && !read[n.id] && /* @__PURE__ */ jsx(Status$1, {
								tone: "wait",
								children: "Cần xử lý"
							})]
						})]
					}, n.id))
				}),
				/* @__PURE__ */ jsx("div", {
					className: "pt-2",
					children: /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setRead(Object.fromEntries(INITIAL_NOTES.map((n) => [n.id, true]))),
						disabled: unread === 0,
						className: "btn-ghost h-10 px-4 text-xs font-semibold",
						children: "Đánh dấu đã đọc tất cả"
					})
				})
			]
		})]
	});
}
//#endregion
//#region src/pages/account/Password.tsx
/** SU-02 Đổi mật khẩu.
*
*  Bắt buộc mật khẩu hiện tại đúng mới cho đổi: đây là ranh giới tin cậy —
*  không có nó thì ai đó ngồi máy đã mở khoá cũng đổi được mật khẩu của bạn,
*  và bạn mất tài khoản mà không hiểu vì sao. */
function Password() {
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [again, setAgain] = useState("");
	const [flash, setFlash] = useState("");
	const [err, setErr] = useState("");
	const submit = (e) => {
		e.preventDefault();
		if (current.length < 1) {
			setErr("Nhập mật khẩu hiện tại.");
			return;
		}
		if (next.length < 8) {
			setErr("Mật khẩu mới cần ít nhất 8 ký tự.");
			return;
		}
		if (next !== again) {
			setErr("Hai mật khẩu mới không khớp nhau.");
			return;
		}
		if (next === current) {
			setErr("Mật khẩu mới phải khác mật khẩu hiện tại.");
			return;
		}
		setErr("");
		setFlash("Đã đổi mật khẩu. Các phiên khác đã đăng xuất.");
		setCurrent("");
		setNext("");
		setAgain("");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "page flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "BẢO MẬT",
			title: "Đổi mật khẩu",
			body: "Đổi mật khẩu sẽ đăng xuất mọi thiết bị khác đang đăng nhập tài khoản này."
		}), /* @__PURE__ */ jsxs("form", {
			onSubmit: submit,
			noValidate: true,
			className: "card flex max-w-[520px] flex-col gap-5 p-5 md:p-6",
			children: [
				/* @__PURE__ */ jsx(Field$2, {
					label: "Mật khẩu hiện tại",
					children: /* @__PURE__ */ jsx("input", {
						className: `input ${err.startsWith("Nhập") ? "border-warn" : ""}`,
						type: "password",
						value: current,
						onChange: (e) => {
							setCurrent(e.target.value);
							setFlash("");
						},
						autoComplete: "current-password"
					})
				}),
				/* @__PURE__ */ jsx(Field$2, {
					label: "Mật khẩu mới",
					hint: "Tối thiểu 8 ký tự, nên có cả chữ và số.",
					children: /* @__PURE__ */ jsx("input", {
						className: "input",
						type: "password",
						value: next,
						onChange: (e) => setNext(e.target.value),
						autoComplete: "new-password"
					})
				}),
				/* @__PURE__ */ jsx(Field$2, {
					label: "Nhập lại mật khẩu mới",
					children: /* @__PURE__ */ jsx("input", {
						className: "input",
						type: "password",
						value: again,
						onChange: (e) => setAgain(e.target.value),
						autoComplete: "new-password"
					})
				}),
				err && /* @__PURE__ */ jsx("p", {
					className: "text-[13px] text-warn",
					children: err
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-11 px-6",
						children: "Đổi mật khẩu"
					}), flash && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: flash
					})]
				})
			]
		})]
	});
}
//#endregion
//#region src/pages/user/Home.tsx
/** Trang chủ sau đăng nhập của người dân: nối 3 việc đang dở thành một màn
*  hình — có yêu cầu nào đang chờ, điểm đang ở hạng nào, bước kế tiếp là gì.
*  Không lặp lại nội dung các trang chuyên biệt, chỉ dẫn tới. */
function UserHome() {
	const user = useUser();
	const { cur, next, pct, need } = tierProgress();
	const open = MY_HANDOVERS.filter((h) => h.status === "pending" || h.status === "accepted" || h.status === "collected");
	const inRank = LEADERBOARD.find((r) => r.you);
	const above = LEADERBOARD.find((r) => r.points > RANK_POINTS);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "TỔNG QUAN",
				title: `Xin chào, ${user || "bạn"}`,
				body: "Từ đây bạn đặt lịch thu gom, nhận tiền về tài khoản và theo dõi điểm xanh của mình."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Yêu cầu đang mở",
						value: String(open.length),
						note: "Chờ hoặc đã nhận"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Điểm tiêu dùng",
						value: fmt(SPEND_POINTS),
						note: "Dùng để đổi quà"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Hạng cây ảo",
						value: cur.name,
						note: next ? `Cần ${fmt(need)} điểm lên ${next.name}` : "Đã đạt hạng cao nhất"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Xếp hạng",
						value: `#${inRank ? LEADERBOARD.indexOf(inRank) + 1 : "—"}`,
						note: above ? `Cần ${fmt(above.points - RANK_POINTS)} điểm để vượt` : "Bạn đang dẫn đầu"
					})
				]
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-5 lg:grid-cols-2",
				children: [/* @__PURE__ */ jsxs("section", {
					className: "card flex flex-col gap-4 p-5",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-base font-bold text-ink",
							children: "Yêu cầu đang mở"
						}),
						open.length === 0 ? /* @__PURE__ */ jsx("p", {
							className: "text-sm text-muted",
							children: "Bạn không có yêu cầu nào đang chờ. Đặt lịch thu gom khi có rác cần bán."
						}) : /* @__PURE__ */ jsx(Table$1, {
							head: [
								"Đối tác",
								"Ngày",
								"Trạng thái"
							],
							children: open.map((h) => /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx(Td$1, {
									className: "font-semibold text-ink",
									children: h.recycler
								}),
								/* @__PURE__ */ jsx(Td$1, {
									className: "tabular-nums whitespace-nowrap",
									children: h.date
								}),
								/* @__PURE__ */ jsx(Td$1, {
									className: "whitespace-nowrap",
									children: h.slot
								})
							] }, h.id))
						}),
						/* @__PURE__ */ jsx(Link, {
							to: "/user/handover",
							className: "text-[13px] font-semibold text-brand hover:text-brand-deep",
							children: "Quản lý yêu cầu →"
						})
					]
				}), /* @__PURE__ */ jsxs("section", {
					className: "card flex flex-col gap-4 p-5",
					children: [
						/* @__PURE__ */ jsx("h2", {
							className: "text-base font-bold text-ink",
							children: "Tiến trình lên hạng"
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-sm font-semibold text-ink",
							children: [cur.name, next && /* @__PURE__ */ jsxs("span", {
								className: "font-normal text-muted",
								children: [" → ", next.name]
							})]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "h-2 overflow-hidden rounded-full bg-surface-3",
							role: "progressbar",
							"aria-valuenow": pct,
							"aria-valuemin": 0,
							"aria-valuemax": 100,
							"aria-label": next ? `Tiến độ lên hạng ${next.name}` : "Đã đạt hạng cao nhất",
							children: /* @__PURE__ */ jsx("div", {
								className: "h-full rounded-full bg-brand",
								style: { width: `${pct}%` }
							})
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-[13px] leading-5 text-muted",
							children: next ? `Cần thêm ${fmt(need)} điểm để lên ${next.name}. Điểm sinh ra từ giao rác đúng phân loại và điểm danh hằng ngày.` : "Bạn đã ở hạng cao nhất."
						})
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/pages/user/Handover.tsx
var priceOf$4 = (id) => WASTES.find((w) => w.id === id)?.price ?? 0;
var nameOf$3 = (id) => WASTES.find((w) => w.id === id)?.name ?? id;
/** U-07 Tạo yêu cầu · U-08 Sửa / Huỷ yêu cầu.
*
*  Nhận trực tiếp tham số `?partnerName=...&waste=...` từ trang Bản đồ (U-05)
*  để mở sẵn biểu mẫu đặt lịch với đúng cơ sở thu mua và loại phế liệu đã chọn. */
function Handover() {
	const [searchParams] = useSearchParams();
	const prefilledPartner = searchParams.get("partnerName") ?? "";
	const prefilledWaste = searchParams.get("waste") ?? "";
	const [open, setOpen] = useState(() => Boolean(prefilledPartner || prefilledWaste));
	const [list, setList] = useState(MY_HANDOVERS);
	const [editId, setEditId] = useState(null);
	const [flash, setFlash] = useState("");
	const reslot = (id, slot) => {
		setList((ls) => ls.map((h) => h.id === id ? {
			...h,
			slot
		} : h));
		setEditId(null);
		setFlash(`${id}: đã đổi khung giờ sang ${slot}. Người thu gom sẽ thấy giờ mới.`);
	};
	const cancel = (h) => {
		const reason = window.prompt(`Huỷ yêu cầu ${h.id}. Lý do (người thu gom sẽ thấy):`);
		if (!reason?.trim()) return;
		setList((ls) => ls.map((x) => x.id === h.id ? {
			...x,
			status: "cancelled",
			reason: reason.trim()
		} : x));
		setFlash(`${h.id}: đã huỷ. Người thu gom sẽ không tới.`);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "BÀN GIAO",
				title: "Yêu cầu thu gom rác",
				body: "Đặt lịch thu gom tại nhà, chọn khung giờ người thu gom có mặt. Bạn có thể sửa giờ hoặc huỷ khi đối tác chưa nhận.",
				action: /* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setOpen((v) => !v),
					className: "btn-primary h-11 shrink-0 px-5",
					children: open ? "Đóng form" : "Tạo yêu cầu mới"
				})
			}),
			flash && /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "text-[13px] font-semibold text-brand",
				children: flash
			}),
			open && /* @__PURE__ */ jsx(CreateForm, {
				initialPartner: prefilledPartner,
				initialWasteId: prefilledWaste,
				onDone: (draft) => {
					setList((ls) => [newRow(draft), ...ls]);
					setOpen(false);
					setFlash(draft.recyclerName ? `Đã gửi yêu cầu tới ${draft.recyclerName}. Đối tác sẽ xác nhận khung giờ trong hôm nay.` : "Đã gửi yêu cầu. Người thu gom sẽ xác nhận khung giờ trong hôm nay.");
				}
			}),
			list.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "card px-5 py-8 text-center text-sm text-muted",
				children: "Bạn chưa có yêu cầu nào. Bấm \"Tạo yêu cầu mới\" để đặt lịch thu gom."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "flex flex-col gap-4",
				children: list.map((h) => /* @__PURE__ */ jsxs("li", {
					className: "card overflow-hidden",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "flex flex-wrap items-center gap-2",
								children: [/* @__PURE__ */ jsx("span", {
									className: "font-bold text-ink",
									children: h.recycler
								}), /* @__PURE__ */ jsx(Status$1, {
									tone: TONE[h.status],
									children: STATUS_LABEL[h.status]
								})]
							}), /* @__PURE__ */ jsxs("p", {
								className: "mt-1 text-[13px] text-muted",
								children: [
									h.id,
									" · ",
									h.date,
									" · ",
									h.slot
								]
							})]
						}), /* @__PURE__ */ jsxs("div", {
							className: "flex shrink-0 gap-2",
							children: [
								h.status === "pending" && /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => setEditId(editId === h.id ? null : h.id),
									className: "btn-outline h-9 px-3 text-[13px]",
									children: editId === h.id ? "Đóng" : "Đổi giờ"
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => cancel(h),
									className: "btn-ghost h-9 px-3 text-[13px]",
									children: "Huỷ yêu cầu"
								})] }),
								h.status === "accepted" && /* @__PURE__ */ jsx(Link, {
									to: "/chat",
									className: "btn-outline h-9 px-3 text-[13px]",
									children: "Nhắn đối tác"
								}),
								h.status === "collected" && /* @__PURE__ */ jsx(Link, {
									to: "/user/receipt",
									className: "btn-primary h-9 px-3 text-[13px]",
									children: "Xác nhận biên nhận"
								}),
								h.status === "done" && /* @__PURE__ */ jsx(Link, {
									to: "/user/transactions",
									className: "btn-ghost h-9 px-3 text-[13px]",
									children: "Xem tiền đã nhận"
								})
							]
						})]
					}), /* @__PURE__ */ jsxs("div", {
						className: "px-5 py-4",
						children: [
							/* @__PURE__ */ jsxs(Table$1, {
								head: [
									"Loại rác",
									"Khối lượng ước tính",
									"Thành tiền ước tính"
								],
								children: [(h.actual ?? h.lines).map((l) => /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx(Td$1, {
										className: "font-semibold text-ink",
										children: nameOf$3(l.wasteId)
									}),
									/* @__PURE__ */ jsxs(Td$1, {
										className: "tabular-nums",
										children: [l.kg.toLocaleString("vi-VN"), " kg"]
									}),
									/* @__PURE__ */ jsx(Td$1, {
										className: "tabular-nums",
										children: VND(l.kg * priceOf$4(l.wasteId))
									})
								] }, l.wasteId)), /* @__PURE__ */ jsxs("tr", { children: [
									/* @__PURE__ */ jsx(Td$1, {
										className: "font-bold text-ink",
										children: h.actual ? "Khối lượng thực nhận" : "Tổng cộng ước tính"
									}),
									/* @__PURE__ */ jsxs(Td$1, {
										className: "tabular-nums font-bold text-ink",
										children: [
											(h.actual ?? h.lines).reduce((s, l) => s + l.kg, 0).toLocaleString("vi-VN"),
											" ",
											"kg"
										]
									}),
									/* @__PURE__ */ jsx(Td$1, {
										className: "tabular-nums font-bold text-brand",
										children: VND(calc(h, priceOf$4).gross)
									})
								] })]
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-3 text-[13px] leading-5 text-muted",
								children: h.address
							}),
							editId === h.id && /* @__PURE__ */ jsxs("div", {
								className: "mt-3 rounded-lg border border-brand/30 bg-brand/6 p-4",
								children: [/* @__PURE__ */ jsx("p", {
									className: "text-[13px] font-semibold text-ink",
									children: "Chọn khung giờ thu gom khác"
								}), /* @__PURE__ */ jsx("div", {
									className: "mt-2 flex flex-wrap gap-2",
									children: TIME_SLOTS.filter((s) => s !== h.slot).map((s) => /* @__PURE__ */ jsx("button", {
										type: "button",
										onClick: () => reslot(h.id, s),
										className: "rounded-full border border-brand bg-white px-3.5 py-2 text-[13px] font-medium text-brand transition-colors hover:bg-brand/10",
										children: s
									}, s))
								})]
							}),
							h.reason && /* @__PURE__ */ jsxs("p", {
								className: "mt-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-[13px] leading-5 text-body",
								children: [
									/* @__PURE__ */ jsx("b", {
										className: "text-ink",
										children: "Lý do huỷ:"
									}),
									" ",
									h.reason
								]
							})
						]
					})]
				}, h.id))
			})
		]
	});
}
var seq = 200;
function newRow(d) {
	seq += 1;
	const now = /* @__PURE__ */ new Date();
	const dd = String(now.getDate()).padStart(2, "0");
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const yyyy = now.getFullYear();
	return {
		id: `BH-2611-0${seq}`,
		recycler: d.recyclerName || "Đang chờ cơ sở gần nhất nhận",
		address: d.address,
		date: `${dd}/${mm}/${yyyy}`,
		slot: d.slot,
		lines: d.rows.map((r) => ({
			wasteId: r.wasteId,
			kg: r.kg
		})),
		status: "pending"
	};
}
function CreateForm({ initialPartner, initialWasteId, onDone }) {
	const validInitialWaste = WASTES.some((w) => w.recyclable && w.id === initialWasteId) ? initialWasteId : "pet";
	const [rows, setRows] = useState([{
		wasteId: validInitialWaste,
		kg: 5
	}]);
	const [slot, setSlot] = useState(TIME_SLOTS[1]);
	const [address, setAddress] = useState("Ngõ 24 Lý Tự Trọng, P. Bến Nghé, Quận 1");
	const [err, setErr] = useState("");
	const set = (i, patch) => setRows((r) => r.map((row, n) => n === i ? {
		...row,
		...patch
	} : row));
	const submit = (e) => {
		e.preventDefault();
		if (rows.find((r) => r.kg <= 0)) {
			setErr("Khối lượng phải lớn hơn 0 kg.");
			return;
		}
		if (!address.trim()) {
			setErr("Cần địa chỉ để người thu gom tìm tới nhà bạn.");
			return;
		}
		setErr("");
		onDone({
			rows,
			slot,
			address,
			recyclerName: initialPartner || void 0
		});
	};
	const { gross } = estimate(rows);
	return /* @__PURE__ */ jsxs("form", {
		onSubmit: submit,
		noValidate: true,
		className: "card flex flex-col gap-5 p-5",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center justify-between gap-2",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-base font-bold text-ink",
					children: "Thông tin rác cần thu gom"
				}), initialPartner && /* @__PURE__ */ jsxs("span", {
					className: "rounded-full border border-brand/25 bg-brand/8 px-3 py-1 text-xs font-semibold text-brand-deep",
					children: ["Đối tác đã chọn: ", initialPartner]
				})]
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "flex flex-col gap-3",
				children: rows.map((r, i) => /* @__PURE__ */ jsxs("li", {
					className: "flex flex-wrap items-end gap-3",
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "flex min-w-[180px] flex-1 flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Loại rác", /* @__PURE__ */ jsx("select", {
								className: "input",
								value: r.wasteId,
								onChange: (e) => set(i, { wasteId: e.target.value }),
								children: WASTES.filter((w) => w.recyclable).map((w) => /* @__PURE__ */ jsxs("option", {
									value: w.id,
									children: [
										w.name,
										" · ",
										VND(w.price),
										"/kg"
									]
								}, w.id))
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "flex w-32 flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Khối lượng (kg)", /* @__PURE__ */ jsx("input", {
								className: "input",
								type: "number",
								min: .5,
								step: .5,
								value: r.kg,
								onChange: (e) => set(i, { kg: Number(e.target.value) })
							})]
						}),
						rows.length > 1 && /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setRows((rs) => rs.filter((_, n) => n !== i)),
							className: "btn-ghost h-12 px-4",
							children: "Bỏ dòng"
						})
					]
				}, i))
			}),
			/* @__PURE__ */ jsx("button", {
				type: "button",
				onClick: () => setRows((r) => [...r, {
					wasteId: "carton",
					kg: 5
				}]),
				className: "btn-outline h-10 w-fit px-4 text-[13px]",
				children: "Thêm loại rác"
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-5 sm:grid-cols-2",
				children: [/* @__PURE__ */ jsxs("label", {
					className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
					children: ["Khung giờ muốn thu gom", /* @__PURE__ */ jsx("select", {
						className: "input",
						value: slot,
						onChange: (e) => setSlot(e.target.value),
						children: TIME_SLOTS.map((s) => /* @__PURE__ */ jsx("option", {
							value: s,
							children: s
						}, s))
					})]
				}), /* @__PURE__ */ jsxs("label", {
					className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
					children: ["Địa chỉ", /* @__PURE__ */ jsx("input", {
						className: "input",
						value: address,
						onChange: (e) => setAddress(e.target.value)
					})]
				})]
			}),
			err && /* @__PURE__ */ jsx("p", {
				className: "text-[13px] text-warn",
				children: err
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
				children: [/* @__PURE__ */ jsx("button", {
					type: "submit",
					className: "btn-primary h-11 px-6",
					children: "Gửi yêu cầu"
				}), /* @__PURE__ */ jsxs("p", {
					className: "text-[13px] text-muted",
					children: [
						"Tiền tạm tính ",
						/* @__PURE__ */ jsx("b", {
							className: "tabular-nums text-ink",
							children: VND(gross)
						}),
						" · người thu gom xác nhận sẽ chốt khung giờ và khối lượng thực tế."
					]
				})]
			})
		]
	});
}
//#endregion
//#region src/pages/user/Receipt.tsx
var priceOf$3 = (id) => WASTES.find((w) => w.id === id)?.price ?? 0;
var nameOf$2 = (id) => WASTES.find((w) => w.id === id)?.name ?? id;
/** U-10 Xác nhận biên nhận bàn giao + U-11 Đánh giá cơ sở thu mua.
*
*  Gộp: U-11 chỉ mở được sau khi U-10 xong, nên tách hai trang thì người
*  dùng phải tự nhớ quay lại. Ở đây chỉ khi xác nhận xong mới hiện phần đánh
*  giá — đúng luật "Mở khi hoàn tất giao dịch". */
function Receipt$1() {
	const h = INCOMING.find((x) => x.status === "collected");
	const [actual, setActual] = useState(() => (h.lines ?? []).map((l) => ({
		wasteId: l.wasteId,
		kg: l.kg
	})));
	const [confirmed, setConfirmed] = useState(false);
	const [stars, setStars] = useState(0);
	const [note, setNote] = useState("");
	const money = calc({
		...h,
		actual
	}, priceOf$3);
	const differs = actual.some((a, i) => a.kg !== h.lines[i]?.kg);
	const confirm = (e) => {
		e.preventDefault();
		setConfirmed(true);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "BIÊN NHẬN",
				title: "Xác nhận bàn giao rác",
				body: "Đối chiếu khối lượng người thu gom cân tại chỗ với những gì bạn bỏ ra. Sai ở đâu thì sửa ở đó — tiền tính trên số bạn xác nhận."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: confirm,
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-4",
						children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "font-bold text-ink",
							children: h.recycler
						}), /* @__PURE__ */ jsxs("p", {
							className: "mt-0.5 text-[13px] text-muted",
							children: [
								h.id,
								" · ",
								h.date,
								" · ",
								h.slot,
								" · ",
								h.address
							]
						})] }), /* @__PURE__ */ jsx(Status$1, {
							tone: TONE[h.status],
							children: STATUS_LABEL[h.status]
						})]
					}),
					/* @__PURE__ */ jsxs(Table$1, {
						head: [
							"Loại rác",
							"Bạn bỏ ra",
							"Người thu gom cân",
							"Thành tiền"
						],
						children: [actual.map((a, i) => /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx(Td$1, {
								className: "font-semibold text-ink",
								children: nameOf$2(a.wasteId)
							}),
							/* @__PURE__ */ jsxs(Td$1, {
								className: "tabular-nums text-muted",
								children: [h.lines[i]?.kg, " kg"]
							}),
							/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx("input", {
								className: "input h-9 w-28 tabular-nums",
								type: "number",
								min: 0,
								step: .1,
								"aria-label": `Khối lượng thực tế ${nameOf$2(a.wasteId)}`,
								value: a.kg,
								disabled: confirmed,
								onChange: (e) => setActual((rs) => rs.map((r, n) => n === i ? {
									...r,
									kg: Number(e.target.value)
								} : r))
							}) }),
							/* @__PURE__ */ jsx(Td$1, {
								className: "tabular-nums font-semibold text-ink",
								children: VND(a.kg * priceOf$3(a.wasteId))
							})
						] }, a.wasteId)), /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx(Td$1, {
								className: "font-bold text-ink",
								children: "Tổng"
							}),
							/* @__PURE__ */ jsxs(Td$1, {
								className: "tabular-nums text-muted",
								children: [h.lines.reduce((s, l) => s + l.kg, 0), " kg"]
							}),
							/* @__PURE__ */ jsxs(Td$1, {
								className: "tabular-nums font-bold text-ink",
								children: [actual.reduce((s, a) => s + a.kg, 0), " kg"]
							}),
							/* @__PURE__ */ jsx(Td$1, {
								className: "tabular-nums font-bold text-brand",
								children: VND(money.gross)
							})
						] })]
					}),
					differs && !confirmed && /* @__PURE__ */ jsx("p", {
						className: "rounded-lg border border-line bg-surface-2 px-4 py-3 text-[13px] leading-5 text-body",
						children: "Khối lượng bạn xác nhận khác với ước tính ban đầu — không sao, đó là bình thường vì người thu gom cân thực tế. Số tiền được tính trên khối lượng bạn nhập ở trên."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap gap-4 border-t border-line-soft pt-4",
						children: [
							/* @__PURE__ */ jsx("button", {
								type: "submit",
								disabled: confirmed,
								className: "btn-primary h-11 px-6",
								children: confirmed ? "Đã xác nhận" : "Xác nhận khối lượng này"
							}),
							/* @__PURE__ */ jsx(Link, {
								to: "/feedback",
								className: "btn-ghost h-11 px-5",
								children: "Sai rồi, tôi muốn khiếu nại"
							}),
							!confirmed && /* @__PURE__ */ jsx("p", {
								className: "self-center text-[13px] text-muted",
								children: "Xác nhận xong hệ thống mới trả tiền về tài khoản của bạn."
							})
						]
					})
				]
			}),
			confirmed && /* @__PURE__ */ jsxs("section", {
				className: "card flex flex-col gap-4 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsxs("h2", {
						className: "text-base font-bold text-ink",
						children: ["Đánh giá ", h.recycler]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-sm text-muted",
						children: "Điểm của bạn quyết định cơ sở này có được đề xuất cho khu vực của bạn không."
					}),
					/* @__PURE__ */ jsx("div", {
						role: "radiogroup",
						"aria-label": "Chấm điểm",
						className: "flex items-center gap-1.5",
						children: [
							1,
							2,
							3,
							4,
							5
						].map((n) => /* @__PURE__ */ jsx("button", {
							type: "button",
							role: "radio",
							"aria-checked": stars === n,
							"aria-label": `${n} sao`,
							onClick: () => setStars(n),
							className: `grid size-11 place-items-center rounded-lg border text-lg transition-colors ${n <= stars ? "border-brand bg-brand/12 text-brand" : "border-line bg-surface text-muted hover:bg-surface-2"}`,
							children: "★"
						}, n))
					}),
					/* @__PURE__ */ jsx("textarea", {
						className: "input h-auto resize-y py-3 leading-6",
						rows: 3,
						value: note,
						onChange: (e) => setNote(e.target.value),
						placeholder: "Ghi lại điều gì tốt, hoặc điều gì nên sửa. Cụ thể thì cơ sở sửa được."
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							disabled: stars === 0,
							className: "btn-primary h-11 px-6",
							children: "Gửi đánh giá"
						}), stars > 0 && /* @__PURE__ */ jsx("p", {
							className: "text-[13px] text-muted",
							children: stars === 5 ? "Cảm ơn bạn, đánh giá này giúp khu vực của bạn." : "Cảm ơn bạn, chúng tôi sẽ xem lại điểm thấp."
						})]
					})
				]
			})
		]
	});
}
//#endregion
//#region src/pages/user/Payout.tsx
/** U-13 Thiết lập tài khoản nhận tiền.
*
*  Chỉ giữ 3 trường thật sự cần: ngân hàng, số tài khoản, chủ tài khoản. Mã QR
*  và hạn mức mỗi lần là chi tiết của cổng thanh toán, không phải thứ người
*  dùng nhập ở đây. */
function Payout() {
	const [bank, setBank] = useState(BANKS[0]);
	const [no, setNo] = useState("007012345678");
	const [holder, setHolder] = useState("Nguyễn Đức");
	const [saved, setSaved] = useState(false);
	const [err, setErr] = useState("");
	const submit = (e) => {
		e.preventDefault();
		if (!validAccount(no)) {
			setErr("Số tài khoản phải là 6 đến 20 chữ số.");
			setSaved(false);
			return;
		}
		if (holder.trim().length < 3) {
			setErr("Tên chủ tài khoản phải khớp với tên trên giấy tờ.");
			setSaved(false);
			return;
		}
		setErr("");
		setSaved(true);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "DÒNG TIỀN",
			title: "Tài khoản nhận tiền",
			body: "Tiền bán rác được EcoLink chuyển thẳng về tài khoản này. Cài một lần, các giao dịch sau tự động về đúng chỗ."
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-6 lg:grid-cols-[1.2fr_1fr]",
			children: [/* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				noValidate: true,
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: ["Ngân hàng", /* @__PURE__ */ jsx("select", {
							className: "input",
							value: bank,
							onChange: (e) => setBank(e.target.value),
							children: BANKS.map((b) => /* @__PURE__ */ jsx("option", {
								value: b,
								children: b
							}, b))
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: [
							"Số tài khoản",
							/* @__PURE__ */ jsx("input", {
								className: `input tabular-nums ${err && !validAccount(no) ? "border-warn" : ""}`,
								inputMode: "numeric",
								value: no,
								onChange: (e) => setNo(e.target.value),
								placeholder: "007012345678"
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-[12px] font-normal text-muted",
								children: "Nhập dấu cách hoặc dấu chấm cũng được, hệ thống tự bỏ."
							})
						]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: [
							"Chủ tài khoản",
							/* @__PURE__ */ jsx("input", {
								className: `input ${err && holder.trim().length < 3 ? "border-warn" : ""}`,
								value: holder,
								onChange: (e) => setHolder(e.target.value)
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-[12px] font-normal text-muted",
								children: "Phải là chính bạn. EcoLink không chuyển tiền vào tài khoản của người khác."
							})
						]
					}),
					err && /* @__PURE__ */ jsx("p", {
						className: "text-[13px] text-warn",
						children: err
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Lưu tài khoản"
						}), saved && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: "Đã lưu. Các khoản chi tiếp theo sẽ về tài khoản này."
						})]
					})
				]
			}), /* @__PURE__ */ jsxs("aside", {
				className: "card flex flex-col gap-4 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "text-base font-bold text-ink",
						children: "Tiền về từ đâu"
					}),
					/* @__PURE__ */ jsx("ol", {
						className: "flex flex-col gap-4",
						children: [
							["Người thu gom nhận rác", "Sau khi bàn giao xong, cơ sở thu mua chuyển tiền qua VietQR về EcoLink."],
							["Hệ thống nhận tiền", "Webhook VietQR báo nhận đủ. EcoLink trừ phí nền tảng rồi tính số tiền về của bạn."],
							["PayOS bắn tiền về tài khoản", "Thường trong vài phút. Xem từng khoản ở Lịch sử dòng tiền."]
						].map(([t, b], i) => /* @__PURE__ */ jsxs("li", {
							className: "flex gap-3",
							children: [/* @__PURE__ */ jsx("span", {
								className: "grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white",
								children: i + 1
							}), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
								className: "text-sm font-semibold text-ink",
								children: t
							}), /* @__PURE__ */ jsx("p", {
								className: "mt-0.5 text-[13px] leading-5 text-muted",
								children: b
							})] })]
						}, t))
					}),
					/* @__PURE__ */ jsx(Link, {
						to: "/user/transactions",
						className: "mt-1 text-[13px] font-semibold text-brand hover:text-brand-deep",
						children: "Xem lịch sử dòng tiền →"
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/pages/user/Transactions.tsx
/** U-14 Xem lịch sử dòng tiền + SYS-01 giải ngân tự động.
*
*  Gộp vì SYS-01 là cách những dòng tiền này được tạo ra: không có hàng
*  "PayOS" nào trên đời mà có hàng này mà không giải thích được nó. Ba loại
*  dòng dùng chung một bảng để thấy mỗi giao dịch có đủ 3 dòng không —
*  thiếu dòng nghĩa là tiền bị kẹt, đó là việc người dùng cần thấy. */
function Transactions() {
	const payout = FLOWS.filter((f) => f.kind === "payout").reduce((s, f) => s + f.amount, 0);
	const fee = FLOWS.filter((f) => f.kind === "fee").reduce((s, f) => s + f.amount, 0);
	const last = FLOWS[0];
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "DÒNG TIỀN",
				title: "Lịch sử tiền vào tài khoản",
				body: "Mỗi lần bàn giao thành công tạo ra ba dòng: người thu gom chuyển vào, phí nền tảng giữ lại, và khoản tiền bị bắn về bạn."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Đã nhận",
						value: fmtVnd(payout),
						note: "Tổng tiền về tài khoản"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Phí nền tảng",
						value: fmtVnd(fee),
						note: "Trích trên giao dịch thành công"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Giao dịch gần nhất",
						value: last.date,
						note: last.handoverId
					})
				]
			}),
			/* @__PURE__ */ jsx(Table$1, {
				head: [
					"Ngày",
					"Mã",
					"Loại",
					"Số tiền",
					"Đối tác",
					"Ghi chú"
				],
				children: FLOWS.map((f) => /* @__PURE__ */ jsxs("tr", {
					className: f.kind === "payout" ? "bg-brand/6" : "",
					children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap tabular-nums",
							children: f.date
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap tabular-nums",
							children: f.handoverId
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
							tone: f.kind === "payout" ? "ok" : f.kind === "fee" ? "off" : "wait",
							children: KIND_LABEL[f.kind]
						}) }),
						/* @__PURE__ */ jsxs(Td$1, {
							className: "font-semibold tabular-nums text-ink",
							children: [f.kind === "fee" ? "−" : "", fmtVnd(f.amount)]
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap",
							children: f.party
						}),
						/* @__PURE__ */ jsx(Td$1, { children: f.note })
					]
				}, f.id))
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Nếu một giao dịch có dòng \"Thu vào từ đối tác\" mà thiếu dòng \"Bãn ra về tài khoản\", tiền đang bị giữ lại do chưa đối chiếu xong. Báo giúp chúng tôi bằng mã giao dịch ở cột Mã."
			})
		]
	});
}
//#endregion
//#region src/pages/user/Gamification.tsx
/** U-15 Điểm danh · U-16 Đổi điểm lấy quà · U-17 Cây ảo & Eco Fact.
*
*  Gộp ba UC vào một trang vì cùng đọc từ `src/data/rewards.ts` và cùng là
*  "phần thưởng". Tách ba trang thì người dùng phải nhớ 3 URL mà nội dung
*  lại liên tục: điểm sinh ra ở đây, dùng ở kia. Điểm danh và đổi quà thật
*  vẫn nằm ở `/rewards` — trang này là tổng quan. */
function Gamification() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "GAMIFICATION",
				title: "Điểm xanh, quà tặng và cây ảo",
				body: "Điểm xanh cộng dồn từ giao rác đúng phân loại. Dùng điểm để đổi quà, và đủ điểm là mở khoá thêm Eco Fact trên cây ảo.",
				action: /* @__PURE__ */ jsx(Link, {
					to: "/rewards",
					className: "btn-primary h-11 shrink-0 px-5",
					children: "Điểm danh và đổi quà"
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Điểm tiêu dùng",
						value: "12.400",
						note: "Dùng để đổi quà, bấm mới trừ"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Điểm xếp hạng",
						value: "23.400",
						note: "Tích luỹ trọn đời, không bao giờ trừ"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Hạng hiện tại",
						value: "Rừng",
						note: "Cần thêm 6.600 điểm để lên Đại dương"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Eco Fact đã mở",
						value: "2 / 6",
						note: "Cần thêm 4.500 điểm cho tất cả"
					})
				]
			}),
			/* @__PURE__ */ jsx(Tree, {}),
			/* @__PURE__ */ jsx(Catalog$1, {})
		]
	});
}
/** U-17 Cây ảo: 6 nhánh, mở dần theo điểm. Vẽ bằng SVG thay vì ảnh — nhánh
*  đổi theo điểm nên ảnh tĩnh không đổi được, còn SVG thì đổi `fill` là xong. */
var BRANCHES = [
	{
		x: 70,
		y: 175,
		cost: 500,
		title: "Nhựa PET tái chế thành sợi"
	},
	{
		x: 130,
		y: 160,
		cost: 800,
		title: "Phân loại 3R tại Việt Nam"
	},
	{
		x: 68,
		y: 130,
		cost: 1200,
		title: "Pin Li-ion gây hoạ hoả"
	},
	{
		x: 132,
		y: 112,
		cost: 1500,
		title: "Màu nắp thùng rác có ý nghĩa"
	},
	{
		x: 74,
		y: 100,
		cost: 2e3,
		title: "Bìa carton thu gom giá 2.200đ/kg"
	},
	{
		x: 126,
		y: 96,
		cost: 3e3,
		title: "Thuế EPR và bài toán bao bì"
	}
];
/** Điểm xếp hạng đủ mở 2 nhánh đầu — suy ra từ hạng Rừng (15.000), không
*  hardcode danh sách mở khoá riêng để hai nơi không lệch nhau. */
var UNLOCKED = 2;
function Tree() {
	return /* @__PURE__ */ jsxs("section", {
		className: "card overflow-hidden",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft px-5 py-4",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "text-lg leading-7 font-bold tracking-tight text-ink",
				children: "Cây ảo của bạn"
			}), /* @__PURE__ */ jsx("p", {
				className: "text-sm text-muted",
				children: "Mỗi Eco Fact mở thêm một nhánh. Điểm chỉ tiêu một lần lúc mở, không mất khi đổi quà."
			})]
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-6 p-5 md:grid-cols-[260px_1fr]",
			children: [/* @__PURE__ */ jsxs("figure", {
				className: "rounded-xl border border-line bg-surface-2 p-4",
				children: [/* @__PURE__ */ jsxs("svg", {
					viewBox: "0 0 200 240",
					className: "w-full",
					role: "img",
					"aria-label": `Cây ảo đang có ${UNLOCKED} trên 6 nhánh đã mở khoá`,
					children: [/* @__PURE__ */ jsx("path", {
						d: "M100 230V120",
						stroke: "var(--color-brand-deep)",
						strokeWidth: "7",
						strokeLinecap: "round"
					}), BRANCHES.map((b, i) => /* @__PURE__ */ jsxs("g", { children: [/* @__PURE__ */ jsx("path", {
						d: `M100 ${200 - i * 14}L${b.x} ${b.y}`,
						stroke: i < UNLOCKED ? "var(--color-brand-deep)" : "var(--color-sage-line)",
						strokeWidth: "5",
						strokeLinecap: "round"
					}), /* @__PURE__ */ jsx("circle", {
						cx: b.x,
						cy: b.y,
						r: "15",
						fill: i < UNLOCKED ? "var(--color-brand)" : "var(--color-surface-3)",
						stroke: i < UNLOCKED ? "var(--color-brand-deep)" : "var(--color-sage-line)",
						strokeWidth: "1.5"
					})] }, b.cost))]
				}), /* @__PURE__ */ jsxs("figcaption", {
					className: "mt-2 text-center text-[13px] text-muted",
					children: [
						UNLOCKED,
						" / ",
						BRANCHES.length,
						" Eco Fact đã mở khoá"
					]
				})]
			}), /* @__PURE__ */ jsx("ul", {
				className: "flex flex-col gap-2.5",
				children: BRANCHES.map((b, i) => /* @__PURE__ */ jsxs("li", {
					className: `flex flex-wrap items-center justify-between gap-2 rounded-lg border px-4 py-3 ${i < UNLOCKED ? "border-brand/30 bg-brand/6" : "border-line bg-surface"}`,
					children: [/* @__PURE__ */ jsxs("span", {
						className: "flex min-w-0 items-center gap-2.5",
						children: [
							/* @__PURE__ */ jsx("span", {
								"aria-hidden": "true",
								className: `grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${i < UNLOCKED ? "bg-brand text-white" : "bg-surface-2 text-muted"}`,
								children: i < UNLOCKED ? "✓" : "·"
							}),
							/* @__PURE__ */ jsx("span", {
								className: `text-sm font-semibold ${i < UNLOCKED ? "text-ink" : "text-body"}`,
								children: b.title
							}),
							/* @__PURE__ */ jsx("span", {
								className: "text-[11px] font-semibold text-muted",
								children: i < UNLOCKED ? "Đã mở" : "Chưa mở"
							})
						]
					}), /* @__PURE__ */ jsxs("span", {
						className: "text-[13px] font-semibold tabular-nums text-muted",
						children: [b.cost.toLocaleString("vi-VN"), " điểm"]
					})]
				}, b.cost))
			})]
		})]
	});
}
/** U-16 Danh mục quà, sắp theo giá tăng dần: người vào để đổi được ngay. */
function Catalog$1() {
	const gifts = GIFTS.filter((g) => g.active).sort((a, b) => a.cost - b.cost);
	return /* @__PURE__ */ jsxs("section", { children: [
		/* @__PURE__ */ jsx("h2", {
			className: "text-lg leading-7 font-bold tracking-tight text-ink",
			children: "Quà đang mở"
		}),
		/* @__PURE__ */ jsx("p", {
			className: "mt-1 text-sm text-muted",
			children: "Đổi bằng điểm tiêu dùng. Đổi xong mới trừ, và điểm xếp hạng giữ nguyên nên không bị tụt hạng."
		}),
		/* @__PURE__ */ jsx("div", {
			className: "mt-4",
			children: /* @__PURE__ */ jsxs(Table$1, {
				head: [
					"Quà tặng",
					"Loại",
					"Điểm",
					"Tồn kho"
				],
				children: [gifts.map((g) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsx(Td$1, {
						className: "font-semibold text-ink",
						children: g.name
					}),
					/* @__PURE__ */ jsx(Td$1, { children: g.kind === "voucher" ? "Phiếu giảm giá" : "Quà vật lý" }),
					/* @__PURE__ */ jsx(Td$1, {
						className: "tabular-nums",
						children: g.cost.toLocaleString("vi-VN")
					}),
					/* @__PURE__ */ jsx(Td$1, { children: g.stock === null ? "Không giới hạn" : g.stock === 0 ? "Hết hàng" : `${g.stock.toLocaleString("vi-VN")} món` })
				] }, g.id)), GRAND_PRIZES.map((g) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsxs(Td$1, {
						className: "font-semibold text-ink",
						children: [g.name, /* @__PURE__ */ jsx("span", {
							className: "ml-2 rounded-full bg-mint/30 px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-brand-deep",
							children: "Giải lớn"
						})]
					}),
					/* @__PURE__ */ jsx(Td$1, { children: "Quà vật lý" }),
					/* @__PURE__ */ jsx(Td$1, {
						className: "tabular-nums",
						children: g.cost.toLocaleString("vi-VN")
					}),
					/* @__PURE__ */ jsx(Td$1, { children: "Giới hạn theo mùa" })
				] }, g.id))]
			})
		})
	] });
}
//#endregion
//#region src/pages/recycler/Home.tsx
/** R-02 Bật/tắt trạng thái hoạt động + tổng quan cơ sở thu mua.
*
*  Công tắc bật/tắt nằm ở trang tổ quan chứ không tách riêng: nó là thứ người
*  thu gom kiểm tra đầu tiên mỗi sáng (đang nhận việc không), nên đặt ở trang
*  này thì thấy ngay, tách trang riêng thì phải vào menu tìm.
*
*  Nút là công tắc thật có `role="switch"` và `aria-checked` để trình đọc
*  màn hình đọc được trạng thái — một nút chỉ có màu đổi thì người dùng
*  khiếm khả năng thị giác không biết mình đang bật hay tắt. */
function RecyclerHome() {
	const [open, setOpen] = useState(true);
	const [flash, setFlash] = useState("");
	const handovers = MY_HANDOVERS.filter((h) => h.status !== "done");
	const payin = FLOWS.filter((f) => f.kind === "payin").reduce((s, f) => s + f.amount, 0);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "VẬN HÀNH",
				title: "Tổng quan cơ sở thu mua",
				body: "Bật trạng thái hoạt động để hiện trên bản đồ và nhận yêu cầu mới. Tắt khi bạn không ra thu gom được."
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "card flex flex-wrap items-center justify-between gap-4 p-5",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "min-w-0",
					children: [/* @__PURE__ */ jsx("p", {
						className: "text-base font-bold text-ink",
						children: "Trạng thái hoạt động"
					}), /* @__PURE__ */ jsx("p", {
						className: "mt-1 text-sm leading-6 text-body",
						children: open ? "Cơ sở của bạn đang hiện trên bản đồ và nhận yêu cầu mới." : "Đã ẩn khỏi bản đồ. Người dân không đặt được lịch cho tới khi bật lại."
					})]
				}), /* @__PURE__ */ jsxs("button", {
					type: "button",
					role: "switch",
					"aria-checked": open,
					onClick: () => {
						setOpen((v) => !v);
						setFlash(open ? "Đã tắt. Cơ sở không còn hiện trên bản đồ và không nhận yêu cầu mới. Lịch đang chờ vẫn giữ nguyên." : "Đã bật. Cơ sở hiện trên bản đồ ngay.");
					},
					className: `inline-flex h-12 shrink-0 items-center gap-3 rounded-full border px-5 text-sm font-semibold transition-colors ${open ? "border-brand bg-brand/10 text-brand-deep" : "border-line bg-surface-2 text-body"}`,
					children: [/* @__PURE__ */ jsx("span", {
						className: `relative h-6 w-11 shrink-0 rounded-full transition-colors ${open ? "bg-brand" : "bg-sage-line"}`,
						children: /* @__PURE__ */ jsx("span", { className: `absolute top-1 size-4 rounded-full bg-white transition-all ${open ? "left-6" : "left-1"}` })
					}), open ? "Đang hoạt động" : "Đã tắt"]
				})]
			}),
			flash && /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "text-[13px] font-semibold text-brand",
				children: flash
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Yêu cầu đang mở",
						value: String(handovers.length),
						note: "Chờ xác nhận hoặc đã nhận"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Cơ sở thu mua",
						value: STATS.recyclers.toLocaleString("vi-VN"),
						note: "Toàn hệ thống"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Tiền đã thu gom",
						value: fmtVnd(payin),
						note: "Đã chuyển qua VietQR"
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Giao dịch 30 ngày",
						value: STATS.handovers30d.toLocaleString("vi-VN"),
						note: "Toàn hệ thống"
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "card flex flex-col gap-4 p-5",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-baseline justify-between gap-3",
					children: [/* @__PURE__ */ jsx("h2", {
						className: "text-base font-bold text-ink",
						children: "Lịch sắp tới"
					}), /* @__PURE__ */ jsx(Link, {
						to: "/recycler/requests",
						className: "text-[13px] font-semibold text-brand hover:text-brand-deep",
						children: "Xem tất cả yêu cầu →"
					})]
				}), handovers.length === 0 ? /* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted",
					children: "Chưa có lịch nào đang mở."
				}) : /* @__PURE__ */ jsx("ul", {
					className: "flex flex-col gap-2",
					children: handovers.map((h) => /* @__PURE__ */ jsxs("li", {
						className: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3",
						children: [/* @__PURE__ */ jsxs("span", {
							className: "min-w-0",
							children: [/* @__PURE__ */ jsx("span", {
								className: "block text-sm font-semibold text-ink",
								children: h.address
							}), /* @__PURE__ */ jsxs("span", {
								className: "block text-[13px] text-muted",
								children: [
									h.date,
									" · ",
									h.slot
								]
							})]
						}), /* @__PURE__ */ jsx(Status$1, {
							tone: h.status === "pending" ? "wait" : "todo",
							children: h.status === "pending" ? "Chờ xác nhận" : "Đã nhận"
						})]
					}, h.id))
				})]
			})
		]
	});
}
//#endregion
//#region src/pages/recycler/Requests.tsx
var priceOf$2 = (id) => WASTES.find((w) => w.id === id)?.price ?? 0;
var nameOf$1 = (id) => WASTES.find((w) => w.id === id)?.name ?? id;
/** R-03 Tiếp nhận / Từ chối yêu cầu.
*
*  Nhận = chốt luôn khung giờ User đề xuất, nên bấm Nhận là một cam kết thời
*  gian. Đã cam kết rồi mà đổi lịch thì phải qua R-04 (huỷ kèm lý do) chứ
*  không sửa lặng lẽ — nếu không, người dùng không biết mình còn phải chờ
*  hay không. */
function Requests() {
	const [list, setList] = useState(INCOMING);
	const [busy, setBusy] = useState("");
	const act = (id, next) => {
		setList((ls) => ls.map((l) => l.id === id ? {
			...l,
			status: next
		} : l));
	};
	/** R-04 huỷ lịch giữa chừng: bắt buộc có lý do vì người dùng đang chờ. */
	const cancel = (id) => {
		const reason = window.prompt("Lý do huỷ lịch thu gom (người dùng sẽ thấy lý do này):");
		if (!reason?.trim()) return;
		setList((ls) => ls.map((l) => l.id === id ? {
			...l,
			status: "broken",
			reason: reason.trim()
		} : l));
	};
	const pending = list.filter((h) => h.status === "pending");
	const active = list.filter((h) => h.status !== "pending");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "YÊU CẦU ĐẾN",
				title: "Tiếp nhận yêu cầu bàn giao",
				body: "Nhận yêu cầu nghĩa là bạn cam kết tới đúng khung giờ người dân đã chọn. Không tới được thì huỷ kèm lý do, họ sẽ tìm người khác."
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h2", {
				className: "text-base font-bold text-ink",
				children: [
					"Chờ bạn xác nhận (",
					pending.length,
					")"
				]
			}), pending.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "card mt-3 px-5 py-8 text-center text-sm text-muted",
				children: "Không có yêu cầu nào đang chờ."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "mt-3 flex flex-col gap-4",
				children: pending.map((h) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-4 p-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-bold text-ink",
									children: h.address
								}), /* @__PURE__ */ jsxs("p", {
									className: "mt-0.5 text-[13px] text-muted",
									children: [
										h.id,
										" · ",
										h.date,
										" · Khung giờ đề xuất:",
										" ",
										/* @__PURE__ */ jsx("b", {
											className: "text-ink",
											children: h.slot
										})
									]
								})]
							}), /* @__PURE__ */ jsx("p", {
								className: "shrink-0 text-base font-bold tabular-nums text-brand",
								children: VND(calc(h, priceOf$2).gross)
							})]
						}),
						/* @__PURE__ */ jsx("ul", {
							className: "flex flex-wrap gap-2",
							children: h.lines.map((l) => /* @__PURE__ */ jsxs("li", {
								className: "rounded-full bg-surface-2 px-3 py-1 text-xs text-body",
								children: [
									nameOf$1(l.wasteId),
									" · ",
									l.kg,
									" kg"
								]
							}, l.wasteId))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap gap-3 border-t border-line-soft pt-4",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								disabled: busy === h.id,
								onClick: () => {
									setBusy(h.id);
									act(h.id, "accepted");
								},
								className: "btn-primary h-11 px-6",
								children: "Nhận và chốt khung giờ"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								disabled: busy === h.id,
								onClick: () => act(h.id, "declined"),
								className: "btn-ghost h-11 px-5",
								children: "Từ chối"
							})]
						})
					]
				}, h.id))
			})] }),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Lịch đã nhận"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table$1, {
					head: [
						"Mã",
						"Địa chỉ",
						"Khung giờ",
						"Tiền ước tính",
						"Trạng thái",
						"Thao tác"
					],
					children: active.map((h) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: h.id
						}),
						/* @__PURE__ */ jsx(Td$1, { children: h.address }),
						/* @__PURE__ */ jsxs(Td$1, {
							className: "whitespace-nowrap",
							children: [
								h.date,
								" · ",
								h.slot
							]
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: VND(calc(h, priceOf$2).gross)
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
							tone: TONE[h.status],
							children: STATUS_LABEL[h.status]
						}) }),
						/* @__PURE__ */ jsx(Td$1, { children: h.status === "collected" ? /* @__PURE__ */ jsx(Link, {
							to: "/recycler/receipt",
							className: "text-[13px] font-semibold text-brand hover:text-brand-deep",
							children: "Tạo biên nhận"
						}) : h.status === "accepted" ? /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => cancel(h.id),
							className: "text-[13px] font-semibold text-warn hover:underline",
							children: "Huỷ lịch"
						}) : /* @__PURE__ */ jsx("span", {
							className: "text-[13px] text-muted",
							children: "—"
						}) })
					] }, h.id))
				})
			})] }),
			/* @__PURE__ */ jsxs("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: [
					"Sau khi tạo biên nhận và người dùng xác nhận khối lượng, tiền về tài khoản của họ và bạn bị trừ phí nền tảng trên mỗi giao dịch. Các khung giờ đã chốt: ",
					TIME_SLOTS.join(" · "),
					"."
				]
			})
		]
	});
}
//#endregion
//#region src/pages/recycler/Catalog.tsx
var priceOf$1 = (id) => WASTES.find((w) => w.id === id)?.price ?? 0;
/** R-01 Danh mục thu mua & bảng giá.
*
*  Bảng giá đặt ở đây và giá ở `/waste` (tra cứu của người dân) là hai con số
*  khác nhau có chủ ý: giá hệ thống là mức trần tham khảo để người dân biết
*  mình bán được bao nhiêu, giá ở đây là giá cơ sở thật sự trả. Người dùng
*  luôn thấy con số hệ thống nên không bị bất ngờ. */
function Catalog() {
	const [rows, setRows] = useState(() => WASTES.filter((w) => w.recyclable).map((w) => ({
		id: w.id,
		on: true,
		price: w.price
	})));
	const [dirty, setDirty] = useState(false);
	const set = (id, patch) => {
		setRows((rs) => rs.map((r) => r.id === id ? {
			...r,
			...patch
		} : r));
		setDirty(true);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "THU MUA",
				title: "Danh mục và bảng giá",
				body: "Chọn loại rác bạn thu mua và đặt giá trả cho người dân. Loại tắt sẽ không hiện trên bản đồ và người dân không đặt được.",
				action: /* @__PURE__ */ jsx("button", {
					type: "button",
					disabled: !dirty,
					onClick: () => setDirty(false),
					className: "btn-primary h-11 shrink-0 px-5",
					children: "Lưu thay đổi"
				})
			}),
			/* @__PURE__ */ jsx(Table$1, {
				head: [
					"Loại rác",
					"Nhóm",
					"Thu mua",
					"Giá bạn trả",
					"Giá hệ thống"
				],
				children: rows.map((r) => {
					const w = WASTES.find((x) => x.id === r.id);
					return /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: w.name
						}),
						/* @__PURE__ */ jsx(Td$1, { children: w.group }),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsxs("label", {
							className: "flex items-center gap-2",
							children: [/* @__PURE__ */ jsx("input", {
								type: "checkbox",
								className: "size-4 accent-brand",
								checked: r.on,
								onChange: (e) => set(r.id, { on: e.target.checked })
							}), /* @__PURE__ */ jsx("span", {
								className: "text-[13px] text-body",
								children: r.on ? "Có" : "Không"
							})]
						}) }),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx("input", {
							className: "input h-9 w-32 tabular-nums",
							type: "number",
							min: 0,
							step: 100,
							disabled: !r.on,
							value: r.price,
							onChange: (e) => set(r.id, { price: Number(e.target.value) }),
							"aria-label": `Giá thu mua ${w.name}`
						}) }),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums text-muted",
							children: VND(priceOf$1(r.id))
						})
					] }, r.id);
				})
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Giá hệ thống là mức trần EcoLink hiển thị cho người dân. Không đặt cao hơn mức đó — yêu cầu sẽ bị từ chối khi đối soát dòng tiền."
			}),
			/* @__PURE__ */ jsx(Status$1, {
				tone: "wait",
				children: "Đổi bảng giá chỉ áp dụng cho yêu cầu tạo sau đây, không đổi giá của các yêu cầu đã chốt."
			})
		]
	});
}
//#endregion
//#region src/pages/recycler/Receipt.tsx
var priceOf = (id) => WASTES.find((w) => w.id === id)?.price ?? 0;
var nameOf = (id) => WASTES.find((w) => w.id === id)?.name ?? id;
/** R-06 Tạo biên nhận bàn giao.
*
*  Nhập khối lượng thực cân tại chỗ, không nhập tiền. Tiền do hệ thống tự
*  giải ngân sau khi người dùng xác nhận (U-10) — có ô "số tiền" ở đây thì
*  cơ sở có thể nhập số tiền tuỳ ý, mà đối soát (A-11) không còn đối chiếu
*  được với gì. */
function Receipt() {
	const h = INCOMING.find((x) => x.status === "collected");
	const [rows, setRows] = useState(() => h.lines.map((l) => ({
		wasteId: l.wasteId,
		kg: l.kg
	})));
	const [files, setFiles] = useState([]);
	const [sent, setSent] = useState(false);
	const money = calc({
		...h,
		actual: rows,
		feeRate: FEE_RATE
	}, priceOf);
	const submit = (e) => {
		e.preventDefault();
		if (rows.some((r) => r.kg <= 0)) return;
		setSent(true);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "BIÊN NHẬN",
			title: "Tạo biên nhận thu gom",
			body: "Nhập khối lượng thực tế bạn vừa cân và chụp ảnh làm bằng chứng. Người dùng xác nhận khối lượng này thì hệ thống mới trả tiền."
		}), /* @__PURE__ */ jsxs("form", {
			onSubmit: submit,
			className: "card flex flex-col gap-5 p-5 md:p-6",
			children: [
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft pb-4",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
						className: "font-bold text-ink",
						children: h.address
					}), /* @__PURE__ */ jsxs("p", {
						className: "mt-0.5 text-[13px] text-muted",
						children: [
							h.id,
							" · ",
							h.date,
							" · ",
							h.slot
						]
					})] }), /* @__PURE__ */ jsxs("span", {
						className: "rounded-full bg-mint/25 px-3 py-1 text-[11px] font-semibold text-brand-deep",
						children: [
							"Người dùng ước tính ",
							h.lines.reduce((s, l) => s + l.kg, 0),
							" kg"
						]
					})]
				}),
				/* @__PURE__ */ jsx(Table$1, {
					head: [
						"Loại rác",
						"Người dùng bỏ ra",
						"Bạn cân được",
						"Thành tiền"
					],
					children: rows.map((r, i) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: nameOf(r.wasteId)
						}),
						/* @__PURE__ */ jsxs(Td$1, {
							className: "tabular-nums text-muted",
							children: [h.lines[i]?.kg, " kg"]
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx("input", {
							className: "input h-9 w-28 tabular-nums",
							type: "number",
							min: 0,
							step: .1,
							"aria-label": `Khối lượng cân thực tế ${nameOf(r.wasteId)}`,
							value: r.kg,
							disabled: sent,
							onChange: (e) => setRows((rs) => rs.map((x, n) => n === i ? {
								...x,
								kg: Number(e.target.value)
							} : x))
						}) }),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums font-semibold text-ink",
							children: VND(r.kg * priceOf(r.wasteId))
						})
					] }, r.wasteId))
				}),
				/* @__PURE__ */ jsxs("label", {
					className: "flex cursor-pointer flex-col gap-2 text-[13px] font-semibold text-ink",
					children: [
						"Ảnh bàn giao (không bắt buộc)",
						/* @__PURE__ */ jsx("span", {
							className: "rounded-lg border border-dashed border-sage-line bg-surface-2 px-4 py-6 text-center text-[13px] font-normal text-muted",
							children: files.length === 0 ? "Chọn ảnh rác đã cân, tối đa 4 ảnh" : files.map((f) => f.name).join(" · ")
						}),
						/* @__PURE__ */ jsx("input", {
							type: "file",
							accept: "image/*",
							multiple: true,
							className: "sr-only",
							onChange: (e) => setFiles(Array.from(e.target.files ?? []).slice(0, 4))
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap gap-6 rounded-xl border border-line bg-surface-2 px-5 py-4",
					children: [
						/* @__PURE__ */ jsxs("p", {
							className: "text-sm text-body",
							children: [
								"Tổng tiền đối tác nhận",
								" ",
								/* @__PURE__ */ jsx("b", {
									className: "tabular-nums text-ink",
									children: VND(money.gross)
								})
							]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-sm text-body",
							children: [
								"Phí nền tảng ",
								(FEE_RATE * 100).toFixed(0),
								"%",
								" ",
								/* @__PURE__ */ jsx("b", {
									className: "tabular-nums text-ink",
									children: VND(money.fee)
								})
							]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-sm text-body",
							children: [
								"Bạn thực nhận",
								" ",
								/* @__PURE__ */ jsx("b", {
									className: "tabular-nums text-brand",
									children: VND(money.net)
								})
							]
						})
					]
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						disabled: sent,
						className: "btn-primary h-11 px-6",
						children: sent ? "Đã gửi biên nhận" : "Gửi biên nhận"
					}), sent && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: "Đã gửi. Chờ người dùng xác nhận khối lượng thì tiền sẽ về tài khoản của họ."
					})]
				})
			]
		})]
	});
}
//#endregion
//#region src/pages/staff/Home.tsx
/** Tổng quan nhân viên (Staff). Không phải bảng điều khiển số liệu lớn như
*  của Admin (A-01) — nhân viên cần biết "hôm nay có bao nhiêu việc đang chờ
*  mình", đó là toàn bộ màn hình này. */
function StaffHome() {
	const queue = [
		{
			to: "/staff/ai-review",
			label: "Ảnh AI nhận diện sai",
			n: STATS.pending.aiCases,
			unit: "ảnh"
		},
		{
			to: "/staff/applications",
			label: "Hồ sơ đối tác thu mua",
			n: STATS.pending.applications,
			unit: "hồ sơ"
		},
		{
			to: "/staff/complaints",
			label: "Khiếu nại giao dịch",
			n: STATS.pending.complaints,
			unit: "khiếu nại"
		},
		{
			to: "/staff/blog",
			label: "Bài blog chờ duyệt",
			n: STATS.pending.posts,
			unit: "bài"
		}
	];
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "VẬN HÀNH",
				title: "Việc đang chờ bạn xử lý",
				body: "Danh sách này là toàn bộ việc tồn đọng của đội ngũ. Xong hết thì báo Admin, không tự ý thêm việc ngoài danh sách này."
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "grid gap-4 sm:grid-cols-2",
				children: queue.map((q) => /* @__PURE__ */ jsxs("li", {
					className: "card flex items-center justify-between gap-4 p-5",
					children: [/* @__PURE__ */ jsxs("div", {
						className: "min-w-0",
						children: [/* @__PURE__ */ jsx("p", {
							className: "text-sm font-semibold text-ink",
							children: q.label
						}), /* @__PURE__ */ jsxs("p", {
							className: "mt-0.5 text-[13px] text-muted",
							children: [
								q.n,
								" ",
								q.unit,
								" đang chờ"
							]
						})]
					}), /* @__PURE__ */ jsx(Link, {
						to: q.to,
						className: "btn-outline h-10 shrink-0 px-4 text-[13px]",
						children: "Xử lý"
					})]
				}, q.to))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Độ chính xác AI",
						value: DATASET.accuracy + "%",
						note: `${fmtInt(DATASET.labeled)} ảnh đã gán nhãn`
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Ảnh trong tập kiểm chứng",
						value: fmtInt(DATASET.total),
						note: `${fmtInt(DATASET.total - DATASET.labeled)} ảnh chờ gán nhãn`
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Kho quà đang mở",
						value: String(GIFTS.filter((g) => g.active).length),
						note: `${GIFTS.filter((g) => g.stock === 0).length} món hết hàng`
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Eco Fact đang mở",
						value: `${ECO_FACTS.filter((f) => f.open).length} / ${ECO_FACTS.length}`,
						note: `${POSTS.filter((p) => p.status === "published").length} bài blog đã xuất bản`
					})
				]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Bạn không có quyền đổi cấu hình hệ thống, phí giao dịch hay tài khoản nhân viên — những phần đó thuộc Admin. Nếu cần thay đổi, gửi yêu cầu kèm lý do."
			})
		]
	});
}
//#endregion
//#region src/pages/staff/AiReview.tsx
/** S-01 Đánh giá ảnh AI nhận diện sai · S-02 Gán nhãn dữ liệu ảnh.
*
*  Gộp vì S-02 là việc bắt buộc phải làm trong lúc S-01: nhân viên đang xem
*  ảnh sai thì gán luôn nhãn đúng, không có lý do phải mở màn hình thứ hai để
*  làm việc đang cầm trên tay. `inDataset` là S-03 (đã đưa vào tập kiểm
*  chứng chưa) nên nó cũng chạy ở đây. */
function AiReview() {
	const [list, setList] = useState(AI_CASES);
	const [pick, setPick] = useState(AI_CASES[0].id);
	const [label, setLabel] = useState(AI_CASES[0].correct);
	const [note, setNote] = useState("");
	const [flash, setFlash] = useState("");
	const cur = list.find((c) => c.id === pick);
	const choose = (id) => {
		const c = list.find((x) => x.id === id);
		setPick(id);
		setLabel(c?.correct ?? "");
		setNote("");
		setFlash("");
	};
	/** Gán nhãn và đánh dấu đã vào tập kiểm chứng trong một thao tác: hai việc
	*  luôn đi cùng nhau, tách ra thì có ảnh đã gán mà chưa vào tập, và cũng có
	*  ảnh vào tập mà vẫn chưa ai xác nhận nhãn. */
	const submit = (e) => {
		e.preventDefault();
		if (!label.trim()) {
			setFlash("Cần chọn nhãn đúng trước khi lưu.");
			return;
		}
		setList((ls) => ls.map((c) => c.id === pick ? {
			...c,
			correct: label,
			inDataset: true
		} : c));
		setFlash(`Đã gán nhãn ${cur.id} và đưa vào tập kiểm chứng.`);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead$1, {
			eyebrow: "DỮ LIỆU AI",
			title: "Ảnh AI nhận diện sai",
			body: "Mỗi lần người dùng báo sai là một cơ hội sửa mô hình. Gán nhãn đúng và đưa ảnh vào tập kiểm chứng trong một lần."
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-5 lg:grid-cols-[1fr_360px]",
			children: [/* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				className: "card flex flex-col gap-4 p-5",
				children: [
					/* @__PURE__ */ jsxs("figure", {
						className: "overflow-hidden rounded-xl border border-line bg-surface-2",
						children: [/* @__PURE__ */ jsx("img", {
							src: cur.image,
							alt: `Ảnh ${cur.id} người dùng báo AI nhận sai`,
							className: "aspect-video w-full object-cover"
						}), /* @__PURE__ */ jsxs("figcaption", {
							className: "flex flex-wrap items-center justify-between gap-2 border-t border-line bg-surface px-4 py-2.5 text-[13px]",
							children: [/* @__PURE__ */ jsx("span", {
								className: "tabular-nums text-ink",
								children: cur.id
							}), /* @__PURE__ */ jsxs("span", {
								className: "text-muted",
								children: [
									cur.date,
									" · báo bởi ",
									cur.reporter
								]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-4 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsxs("div", {
							className: "rounded-lg border border-line bg-surface-2 px-4 py-3",
							children: [
								/* @__PURE__ */ jsx("p", {
									className: "text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
									children: "AI đoán"
								}),
								/* @__PURE__ */ jsx("p", {
									className: "mt-1 text-base font-bold text-body",
									children: cur.predicted
								}),
								/* @__PURE__ */ jsxs("p", {
									className: "mt-0.5 text-[13px] text-muted",
									children: [
										"Độ tin cậy ",
										cur.confidence,
										"%"
									]
								})
							]
						}), /* @__PURE__ */ jsxs("label", {
							className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Nhãn đúng", /* @__PURE__ */ jsxs("select", {
								className: "input",
								value: label,
								onChange: (e) => {
									setLabel(e.target.value);
									setFlash("");
								},
								children: [/* @__PURE__ */ jsx("option", {
									value: "",
									children: "Chọn nhãn đúng"
								}), WASTES.map((w) => /* @__PURE__ */ jsx("option", {
									value: w.name,
									children: w.name
								}, w.id))]
							})]
						})]
					}),
					/* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: ["Nhận xét (không bắt buộc)", /* @__PURE__ */ jsx("input", {
							className: "input",
							value: note,
							onChange: (e) => setNote(e.target.value),
							placeholder: "Ví dụ: nền tối, ảnh chụp ngược, vật liệu lẫn nhiều loại"
						})]
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Lưu nhãn và thêm vào tập kiểm chứng"
						}), flash && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: flash
						})]
					})
				]
			}), /* @__PURE__ */ jsxs("aside", { children: [/* @__PURE__ */ jsxs("h2", {
				className: "text-sm font-bold text-ink",
				children: [
					"Hàng chờ (",
					list.filter((c) => !c.inDataset).length,
					" chưa xử lý)"
				]
			}), /* @__PURE__ */ jsx("ul", {
				className: "mt-3 flex flex-col gap-2",
				children: list.map((c) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsxs("button", {
					type: "button",
					onClick: () => choose(c.id),
					className: `flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${pick === c.id ? "border-brand bg-brand/8" : "border-line bg-surface hover:bg-surface-2"}`,
					children: [
						/* @__PURE__ */ jsx("img", {
							src: c.image,
							alt: "",
							className: "size-11 shrink-0 rounded object-cover",
							loading: "lazy"
						}),
						/* @__PURE__ */ jsxs("span", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ jsx("span", {
								className: "block truncate text-[13px] font-semibold text-ink",
								children: c.correct
							}), /* @__PURE__ */ jsxs("span", {
								className: "block truncate text-[12px] text-muted",
								children: ["AI đoán ", c.predicted]
							})]
						}),
						/* @__PURE__ */ jsx(Status$1, {
							tone: c.inDataset ? "ok" : "wait",
							children: c.inDataset ? "Đã gán" : "Chờ"
						})
					]
				}) }, c.id))
			})] })]
		})]
	});
}
//#endregion
//#region src/pages/staff/Dataset.tsx
/** S-03 Cập nhật tập dữ liệu kiểm chứng: xem độ phủ theo lớp và độ chính xác
*  từng lớp. Lớp có độ chính xác thấp là lớp cần thêm ảnh, nên bảng sắp theo
*  độ chính xác tăng dần để thấy ngay chỗ yếu ở trên cùng. */
function Dataset() {
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "DỮ LIỆU AI",
				title: "Tập dữ liệu kiểm chứng",
				body: "Tập ảnh có nhãn dùng để đo độ chính xác mô hình. Bảng sắp theo độ chính xác tăng dần: lớp yếu nhất ở trên cùng."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-3",
				children: [
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Tổng ảnh trong tập",
						value: fmtInt(DATASET.total)
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Đã gán nhãn",
						value: fmtInt(DATASET.labeled),
						note: `${fmtInt(DATASET.total - DATASET.labeled)} ảnh chờ gán`
					}),
					/* @__PURE__ */ jsx(Stat$1, {
						label: "Độ chính xác",
						value: `${DATASET.accuracy}%`,
						note: "Đo trên tập kiểm chứng"
					})
				]
			}),
			/* @__PURE__ */ jsx(Table$1, {
				head: [
					"Lớp vật liệu",
					"Số ảnh",
					"Độ chính xác",
					"Trạng thái"
				],
				children: [...DATASET.byClass].sort((a, b) => a.accuracy - b.accuracy).map((c) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsx(Td$1, {
						className: "font-semibold text-ink",
						children: c.label
					}),
					/* @__PURE__ */ jsx(Td$1, {
						className: "tabular-nums",
						children: fmtInt(c.count)
					}),
					/* @__PURE__ */ jsxs(Td$1, {
						className: "tabular-nums",
						children: [c.accuracy, "%"]
					}),
					/* @__PURE__ */ jsx(Td$1, { children: c.accuracy < 90 ? /* @__PURE__ */ jsx("span", {
						className: "font-semibold text-brand",
						children: "Cần ưu tiên thu thập"
					}) : /* @__PURE__ */ jsx("span", {
						className: "text-muted",
						children: "Đạt"
					}) })
				] }, c.label))
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Ảnh gán từ báo cáo của người dùng được đưa vào đây tự động khi nhân viên xác nhận ở trang đánh giá ảnh AI. Muốn bổ sung ảnh chủ động thì tải lên tập riêng và ghi rõ nguồn, để không trộn ảnh chưa kiểm tra vào tập đo lười."
			})
		]
	});
}
//#endregion
//#region src/pages/staff/Applications.tsx
/** S-04 Thẩm định hồ sơ đối tác thu mua. Hồ sơ từ chối phải có lý do vì cơ sở
*  đã nộp giấy tờ và chờ kết quả — từ chối không nói lý do thì họ không biết
*  phải bổ sung gì, và sẽ nộp lại y hệt. */
function Applications() {
	const [list, setList] = useState(APPLICATIONS);
	const [flash, setFlash] = useState("");
	const decide = (id, ok) => {
		let note;
		if (!ok) {
			const reason = window.prompt(`Từ chối hồ sơ ${id}. Lý do (cơ sở sẽ thấy lý do này):`);
			if (!reason?.trim()) return;
			note = reason.trim();
		}
		setList((ls) => ls.map((a) => a.id === id ? {
			...a,
			status: ok ? "approved" : "rejected",
			note
		} : a));
		setFlash(ok ? `${id}: đã duyệt.` : `${id}: đã từ chối với lý do "${note}".`);
	};
	const pending = list.filter((a) => a.status === "pending");
	const done = list.filter((a) => a.status !== "pending");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "ĐỐI TÁC",
				title: "Thẩm định hồ sơ cơ sở thu mua",
				body: "Chỉ duyệt khi giấy phép còn hiệu lực và địa chỉ trùng với nơi thu gom thực tế. Từ chối thì phải nói lý do để họ bổ sung được."
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h2", {
				className: "text-base font-bold text-ink",
				children: [
					"Chờ thẩm định (",
					pending.length,
					")"
				]
			}), pending.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "card mt-3 px-5 py-8 text-center text-sm text-muted",
				children: "Không có hồ sơ nào đang chờ."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "mt-3 flex flex-col gap-4",
				children: pending.map((a) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-4 p-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-bold text-ink",
									children: a.name
								}), /* @__PURE__ */ jsxs("p", {
									className: "mt-0.5 text-[13px] text-muted",
									children: [
										a.id,
										" · ",
										a.date,
										" · ",
										a.address
									]
								})]
							}), /* @__PURE__ */ jsx("span", {
								className: "rounded-full bg-surface-2 px-3 py-1 text-[13px] text-body",
								children: a.materials
							})]
						}),
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "text-[13px] font-semibold text-ink",
							children: "Giấy tờ đã đính kèm"
						}), /* @__PURE__ */ jsx("ul", {
							className: "mt-2 flex flex-wrap gap-2",
							children: a.docs.map((d) => /* @__PURE__ */ jsx("li", {
								className: "rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-body",
								children: d
							}, d))
						})] }),
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap gap-3 border-t border-line-soft pt-4",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => decide(a.id, true),
								className: "btn-primary h-11 px-6",
								children: "Duyệt hồ sơ"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => decide(a.id, false),
								className: "btn-ghost h-11 px-5",
								children: "Từ chối"
							})]
						})
					]
				}, a.id))
			})] }),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Đã xử lý"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table$1, {
					head: [
						"Mã",
						"Tên cơ sở",
						"Địa chỉ",
						"Ngày nộp",
						"Kết quả",
						"Lý do"
					],
					children: done.map((a) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: a.id
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: a.name
						}),
						/* @__PURE__ */ jsx(Td$1, { children: a.address }),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: a.date
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
							tone: a.status === "approved" ? "ok" : "off",
							children: a.status === "approved" ? "Đã duyệt" : "Từ chối"
						}) }),
						/* @__PURE__ */ jsx(Td$1, { children: a.note ?? "—" })
					] }, a.id))
				})
			})] }),
			flash && /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "text-[13px] font-semibold text-brand",
				children: flash
			})
		]
	});
}
//#endregion
//#region src/pages/staff/Complaints.tsx
/** S-05 Xử lý khiếu nại giao dịch.
*
*  Khiếu nại mà đóng mà không có câu trả lời gửi cho người dùng thì người
*  dùng sẽ hỏi lại. Ở đây bắt buộc nhập nội dung phản hồi khi chuyển sang
*  "đã xử lý" — nếu cho đóng không cần trả lời thì hầu hết ca sẽ đóng im lặng. */
function Complaints() {
	const [list, setList] = useState(COMPLAINTS);
	const [reply, setReply] = useState({});
	const [flash, setFlash] = useState("");
	const take = (id) => setList((ls) => ls.map((c) => c.id === id && c.status === "new" ? {
		...c,
		status: "working"
	} : c));
	const resolve = (id) => {
		const text = (reply[id] ?? "").trim();
		if (text.length < 10) {
			setFlash("Cần viết phản hồi ít nhất 10 ký tự trước khi đóng khiếu nại.");
			return;
		}
		setList((ls) => ls.map((c) => c.id === id ? {
			...c,
			status: "resolved",
			reply: text
		} : c));
		setFlash("");
	};
	const open = list.filter((c) => c.status !== "resolved");
	const closed = list.filter((c) => c.status === "resolved");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "HỖ TRỢ",
				title: "Khiếu nại giao dịch",
				body: "Đối chiếu với biên nhận và lịch sử dòng tiền trước khi trả lời. Mọi ca đóng đều phải có phản hồi gửi cho người dùng."
			}),
			flash && /* @__PURE__ */ jsx("p", {
				className: "text-[13px] font-semibold text-warn",
				children: flash
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "flex flex-col gap-4",
				children: open.map((c) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-4 p-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("p", {
									className: "font-bold text-ink",
									children: c.title
								}), /* @__PURE__ */ jsxs("p", {
									className: "mt-0.5 text-[13px] text-muted",
									children: [
										c.id,
										" · ",
										c.date,
										" · ",
										c.user,
										" · liên quan ",
										c.target
									]
								})]
							}), /* @__PURE__ */ jsx(Status$1, {
								tone: c.status === "new" ? "wait" : "todo",
								children: c.status === "new" ? "Mới" : "Đang xử lý"
							})]
						}),
						/* @__PURE__ */ jsxs("label", {
							className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
							children: ["Phản hồi cho người dùng", /* @__PURE__ */ jsx("textarea", {
								className: "input h-auto resize-y py-3 leading-6",
								rows: 3,
								value: reply[c.id] ?? "",
								onChange: (e) => setReply((r) => ({
									...r,
									[c.id]: e.target.value
								})),
								placeholder: "Nêu rõ đã kiểm tra gì, kết luận gì, và người dùng cần làm gì tiếp."
							})]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap gap-3 border-t border-line-soft pt-4",
							children: [c.status === "new" && /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => take(c.id),
								className: "btn-ghost h-11 px-5",
								children: "Nhận xử lý"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => resolve(c.id),
								className: "btn-primary h-11 px-6",
								children: "Đóng khiếu nại"
							})]
						})
					]
				}, c.id))
			}),
			closed.length > 0 && /* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Đã đóng"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table$1, {
					head: [
						"Mã",
						"Vấn đề",
						"Người báo",
						"Kết quả"
					],
					children: closed.map((c) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: c.id
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: c.title
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap",
							children: c.user
						}),
						/* @__PURE__ */ jsx(Td$1, { children: c.reply ?? "—" })
					] }, c.id))
				})
			})] })
		]
	});
}
//#endregion
//#region src/pages/staff/Accounts.tsx
/** S-06 Xem danh sách & chi tiết User/Buyer · S-07 Khoá / xoá tài khoản.
*
*  Khoá là hành động đảo ngược được (mở khoá lại được), xoá thì không — nên
*  UI tách rõ hai việc. Xoá chỉ cho tài khoản chưa từng có giao dịch: tài
*  khoản đã có `deals` thì xoá là mất dữ liệu đối soát dòng tiền, phải khoá
*  thôi. */
function Accounts() {
	const [list, setList] = useState(ACCOUNTS);
	const [role, setRole] = useState("all");
	const [q, setQ] = useState("");
	const [pick, setPick] = useState(null);
	const [flash, setFlash] = useState("");
	const view = list.filter((a) => {
		const k = q.trim().toLowerCase();
		return (!k || a.name.toLowerCase().includes(k) || a.email.includes(k) || a.id.includes(k)) && (role === "all" || a.role === role);
	});
	const lock = (id) => setList((ls) => ls.map((a) => a.id === id ? {
		...a,
		status: a.status === "locked" ? "active" : "locked"
	} : a));
	const remove = (a) => {
		if (a.deals > 0) {
			setFlash(`${a.name} đã có ${a.deals} giao dịch nên không xoá được — dữ liệu đối soát còn cần. Hãy khoá tài khoản.`);
			return;
		}
		if (!window.confirm(`Xoá ${a.name} (${a.id})? Không khôi phục được.`)) return;
		setList((ls) => ls.filter((x) => x.id !== a.id));
		setPick(null);
		setFlash(`Đã xoá ${a.name}.`);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "TÀI KHOẢN",
				title: "Danh sách User và Buyer",
				body: "Xem tài khoản và sửa xử lý vi phạm. Tài khoản đã có giao dịch chỉ khoá được, không xoá — dữ liệu đối soát dòng tiền còn cần tới."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "card flex flex-col gap-4 p-4 md:flex-row md:items-end",
				children: [/* @__PURE__ */ jsx("div", {
					className: "min-w-0 flex-1",
					children: /* @__PURE__ */ jsxs("label", {
						className: "flex flex-col gap-2 text-[13px] font-semibold text-ink",
						children: ["Tìm tài khoản", /* @__PURE__ */ jsx("input", {
							className: "input",
							type: "search",
							value: q,
							onChange: (e) => setQ(e.target.value),
							placeholder: "Tên, email hoặc mã tài khoản"
						})]
					})
				}), /* @__PURE__ */ jsx("div", {
					className: "flex gap-2",
					children: [
						"all",
						"user",
						"recycler"
					].map((r) => /* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setRole(r),
						"aria-pressed": role === r,
						className: `h-12 rounded-lg border px-4 text-[13px] font-semibold transition-colors ${role === r ? "border-brand bg-brand text-white" : "border-line bg-surface text-body hover:bg-surface-2"}`,
						children: r === "all" ? "Tất cả" : r === "user" ? "Người dân" : "Cơ sở thu mua"
					}, r))
				})]
			}),
			flash && /* @__PURE__ */ jsx("p", {
				className: "text-[13px] font-semibold text-warn",
				children: flash
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-5 lg:grid-cols-[1.6fr_1fr]",
				children: [/* @__PURE__ */ jsx(Table$1, {
					head: [
						"Mã",
						"Tên",
						"Vai trò",
						"Khu vực",
						"Giao dịch",
						"Trạng thái",
						""
					],
					children: view.map((a) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: a.id
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: a.name
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap",
							children: a.role === "user" ? "Người dân" : "Cơ sở thu mua"
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap",
							children: a.area
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums",
							children: a.deals
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
							tone: a.status === "active" ? "ok" : "off",
							children: a.status === "active" ? "Hoạt động" : "Đã khoá"
						}) }),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsxs("span", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => setPick(a),
								className: "text-[13px] font-semibold text-brand hover:text-brand-deep",
								children: "Chi tiết"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => lock(a.id),
								className: "text-[13px] font-semibold text-warn hover:underline",
								children: a.status === "active" ? "Khoá" : "Mở khoá"
							})]
						}) })
					] }, a.id))
				}), /* @__PURE__ */ jsx("aside", {
					className: "card flex flex-col gap-4 p-5",
					children: !pick ? /* @__PURE__ */ jsx("p", {
						className: "text-sm text-muted",
						children: "Chọn \"Chi tiết\" ở một dòng để xem đầy đủ và xử lý vi phạm."
					}) : /* @__PURE__ */ jsxs(Fragment, { children: [
						/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("p", {
							className: "text-base font-bold text-ink",
							children: pick.name
						}), /* @__PURE__ */ jsxs("p", {
							className: "mt-0.5 text-[13px] text-muted",
							children: [
								pick.id,
								" · ",
								pick.email
							]
						})] }),
						/* @__PURE__ */ jsx("dl", {
							className: "flex flex-col gap-2 text-sm",
							children: [
								["Vai trò", pick.role === "user" ? "Người dân" : "Cơ sở thu mua"],
								["Khu vực", pick.area],
								["Ngày tham gia", pick.joined],
								["Giao dịch hoàn tất", String(pick.deals)]
							].map(([k, v]) => /* @__PURE__ */ jsxs("div", {
								className: "flex justify-between gap-3 border-b border-line-soft pb-2",
								children: [/* @__PURE__ */ jsx("dt", {
									className: "text-muted",
									children: k
								}), /* @__PURE__ */ jsx("dd", {
									className: "font-semibold text-ink",
									children: v
								})]
							}, k))
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap gap-2 border-t border-line-soft pt-4",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => lock(pick.id),
								className: "btn-outline h-10 px-4 text-[13px]",
								children: pick.status === "active" ? "Khoá tài khoản" : "Mở khoá"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => remove(pick),
								className: "btn-ghost h-10 px-4 text-[13px] text-warn",
								children: "Xoá tài khoản"
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-[13px] leading-5 text-muted",
							children: pick.deals > 0 ? `Tài khoản này có ${pick.deals} giao dịch nên không xoá được.` : "Tài khoản chưa có giao dịch nên xoá được."
						})
					] })
				})]
			})
		]
	});
}
//#endregion
//#region src/pages/staff/BlogEditor.tsx
/** S-08 Soạn thảo bài đăng Blog.
*
*  Bài của nhân viên luôn ở trạng thái "chờ duyệt" — không có đường xuất bản
*  thẳng. Nếu để nhân viên tự xuất bản thì A-09 mất hết ý nghĩa, và người
*  đọc tin giả là tin thật. */
function BlogEditor() {
	const [list, setList] = useState(POSTS);
	const [title, setTitle] = useState("");
	const [excerpt, setExcerpt] = useState("");
	const [flash, setFlash] = useState("");
	const submit = (e) => {
		e.preventDefault();
		if (title.trim().length < 10) {
			setFlash("Tiêu đề cần ít nhất 10 ký tự.");
			return;
		}
		if (excerpt.trim().length < 30) {
			setFlash("Tóm tắt cần ít nhất 30 ký tự để người đọc biết bài nói gì.");
			return;
		}
		const id = `BL-${String(list.length + 89).padStart(4, "0")}`;
		setList((ls) => [{
			id,
			title: title.trim(),
			excerpt: excerpt.trim(),
			author: "Lê Thu Hà",
			date: "30/09/2026",
			status: "pending"
		}, ...ls]);
		setTitle("");
		setExcerpt("");
		setFlash(`Đã gửi ${id} sang Admin duyệt. Bài chưa hiện công khai cho tới khi duyệt.`);
	};
	const pending = list.filter((p) => p.status === "pending");
	const rest = list.filter((p) => p.status !== "pending");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "NỘI DUNG",
				title: "Soạn bài Blog",
				body: "Viết bài rồi gửi Admin duyệt. Bài ở trạng thái chờ duyệt không hiện công khai, và sẽ tự xuất bản ngay khi được duyệt."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: submit,
				noValidate: true,
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx(Field$2, {
						label: "Tiêu đề",
						children: /* @__PURE__ */ jsx("input", {
							className: "input",
							value: title,
							onChange: (e) => {
								setTitle(e.target.value);
								setFlash("");
							},
							placeholder: "Nêu rõ điều bài nói, không dùng tiêu đề chung chung"
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Tóm tắt",
						hint: "Hai ba câu, hiện ở đầu bài và trong danh sách bài mới.",
						children: /* @__PURE__ */ jsx("textarea", {
							className: "input h-auto resize-y py-3 leading-6",
							rows: 3,
							value: excerpt,
							onChange: (e) => {
								setExcerpt(e.target.value);
								setFlash("");
							},
							placeholder: "Đọc phần tóm tắt là người đọc biết có nên mở bài hay không."
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Gửi Admin duyệt"
						}), flash && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: flash
						})]
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h2", {
				className: "text-base font-bold text-ink",
				children: [
					"Chờ duyệt (",
					pending.length,
					")"
				]
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table$1, {
					head: [
						"Mã",
						"Tiêu đề",
						"Tác giả",
						"Ngày",
						"Trạng thái"
					],
					children: pending.map((p) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: p.id
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: p.title
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "whitespace-nowrap",
							children: p.author
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: p.date
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
							tone: "wait",
							children: "Chờ duyệt"
						}) })
					] }, p.id))
				})
			})] }),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Đã xử lý"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table$1, {
					head: [
						"Mã",
						"Tiêu đề",
						"Ngày",
						"Kết quả",
						"Lý do"
					],
					children: rest.map((p) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: p.id
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "font-semibold text-ink",
							children: p.title
						}),
						/* @__PURE__ */ jsx(Td$1, {
							className: "tabular-nums whitespace-nowrap",
							children: p.date
						}),
						/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
							tone: p.status === "published" ? "ok" : "off",
							children: p.status === "published" ? "Đã xuất bản" : "Bị từ chối"
						}) }),
						/* @__PURE__ */ jsx(Td$1, { children: p.note ?? "—" })
					] }, p.id))
				})
			})] })
		]
	});
}
//#endregion
//#region src/pages/staff/EcoFacts.tsx
/** S-09 Quản lý nội dung Eco Fact.
*
*  Nội dung Eco Fact là thứ người dùng đọc để biết vì sao họ làm đúng, nên
*  phải có nguồn và phải mở được bằng điểm. Form bắt buộc có "chi phí mở
*  khoá" vì đó là con số A-07 dùng chung — không nhập thì Eco Fact mới sẽ
*  không ai mở nổi. */
function EcoFacts() {
	const [list, setList] = useState(ECO_FACTS);
	const [title, setTitle] = useState("");
	const [body, setBody] = useState("");
	const [cost, setCost] = useState(500);
	const [flash, setFlash] = useState("");
	const add = (e) => {
		e.preventDefault();
		if (title.trim().length < 8) {
			setFlash("Tiêu đề cần ít nhất 8 ký tự.");
			return;
		}
		if (body.trim().length < 40) {
			setFlash("Nội dung cần ít nhất 40 ký tự để đủ một kiến thức dùng được.");
			return;
		}
		const id = `EF-${String(list.length + 1).padStart(2, "0")}`;
		setList((ls) => [...ls, {
			id,
			title: title.trim(),
			body: body.trim(),
			cost,
			open: false
		}]);
		setTitle("");
		setBody("");
		setFlash(`Đã thêm ${id}. Nội dung mới mở sau khi người dùng đủ điểm.`);
	};
	const remove = (id) => {
		setList((ls) => ls.filter((f) => f.id !== id));
		setFlash(`Đã xoá ${id}.`);
	};
	const toggle = (id) => setList((ls) => ls.map((f) => f.id === id ? {
		...f,
		open: !f.open
	} : f));
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "NỘI DUNG",
				title: "Quản lý Eco Fact",
				body: "Kiến thức ngắn gắn với cây ảo: người dùng mở bằng điểm đã tích luỹ. Nội dung sai thì cả cây ảo mất ý nghĩa."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: add,
				noValidate: true,
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx(Field$2, {
						label: "Tiêu đề kiến thức",
						children: /* @__PURE__ */ jsx("input", {
							className: "input",
							value: title,
							onChange: (e) => setTitle(e.target.value),
							placeholder: "Ví dụ: Vì sao nắp nhựa phải tách riêng"
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Nội dung",
						hint: "Tối đa 3 câu. Có con số thì ghi rõ con số và nguồn của nó.",
						children: /* @__PURE__ */ jsx("textarea", {
							className: "input h-auto resize-y py-3 leading-6",
							rows: 3,
							value: body,
							onChange: (e) => setBody(e.target.value)
						})
					}),
					/* @__PURE__ */ jsx(Field$2, {
						label: "Điểm cần để mở",
						hint: "Số điểm tiêu dùng, tức là sẽ bị trừ một lần khi mở.",
						children: /* @__PURE__ */ jsx("input", {
							className: "input w-40 tabular-nums",
							type: "number",
							min: 0,
							step: 100,
							value: cost,
							onChange: (e) => setCost(Number(e.target.value))
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Thêm Eco Fact"
						}), flash && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: flash
						})]
					})
				]
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "grid gap-4 md:grid-cols-2",
				children: list.map((f) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-3 p-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("p", {
									className: "text-[13px] font-semibold text-brand",
									children: f.id
								}), /* @__PURE__ */ jsx("h2", {
									className: "text-base leading-6 font-bold text-ink",
									children: f.title
								})]
							}), /* @__PURE__ */ jsx(Status$1, {
								tone: f.open ? "ok" : "off",
								children: f.open ? "Đang mở" : "Đang khoá"
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-[13px] leading-5 text-body",
							children: f.body
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3 text-[13px]",
							children: [/* @__PURE__ */ jsxs("span", {
								className: "tabular-nums text-muted",
								children: [f.cost.toLocaleString("vi-VN"), " điểm để mở"]
							}), /* @__PURE__ */ jsxs("span", {
								className: "flex gap-3",
								children: [/* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => toggle(f.id),
									className: "font-semibold text-brand hover:text-brand-deep",
									children: f.open ? "Khoá" : "Mở miễn phí"
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => remove(f.id),
									className: "font-semibold text-warn hover:underline",
									children: "Xoá"
								})]
							})]
						})
					]
				}, f.id))
			})
		]
	});
}
//#endregion
//#region src/pages/staff/Gifts.tsx
/** S-10 Quản lý kho quà tặng.
*
*  `stock: null` nghĩa là không giới hạn (voucher), không phải "chưa nhập số".
*  Khoảng trống đó dễ gây hiểu nhầm nên trong bảng hiện thành chữ "Không giới
*  hạn" chứ không để ô số trống. */
function Gifts() {
	const [list, setList] = useState(GIFTS);
	const [name, setName] = useState("");
	const [cost, setCost] = useState(2e3);
	const [stock, setStock] = useState(50);
	const [flash, setFlash] = useState("");
	const set = (id, patch) => setList((ls) => ls.map((g) => g.id === id ? {
		...g,
		...patch
	} : g));
	const add = (e) => {
		e.preventDefault();
		if (name.trim().length < 5) {
			setFlash("Tên quà cần ít nhất 5 ký tự.");
			return;
		}
		const id = `g-${Date.now().toString(36)}`;
		setList((ls) => [...ls, {
			id,
			name: name.trim(),
			cost,
			stock,
			kind: "gift",
			active: true
		}]);
		setName("");
		setFlash(`Đã thêm ${name.trim()}. Người dùng thấy nó ngay ở trang đổi thưởng.`);
	};
	const remove = (id) => {
		setList((ls) => ls.filter((g) => g.id !== id));
		setFlash("Đã xoá món quà khỏi kho.");
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "KHO QUÀ",
				title: "Quà tặng và voucher",
				body: "Tồn kho là thứ người dùng thấy trước khi đổi. Số vượt 15 món thì gắn nhãn khan hiếm, số 0 thì ẩn khỏi trang đổi."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: add,
				noValidate: true,
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "grid gap-5 sm:grid-cols-[2fr_1fr_1fr]",
					children: [
						/* @__PURE__ */ jsx(Field$2, {
							label: "Tên quà",
							children: /* @__PURE__ */ jsx("input", {
								className: "input",
								value: name,
								onChange: (e) => setName(e.target.value),
								placeholder: "Ví dụ: Bộ dụng cụ thu gom gia đình"
							})
						}),
						/* @__PURE__ */ jsx(Field$2, {
							label: "Điểm đổi",
							children: /* @__PURE__ */ jsx("input", {
								className: "input tabular-nums",
								type: "number",
								min: 0,
								step: 500,
								value: cost,
								onChange: (e) => setCost(Number(e.target.value))
							})
						}),
						/* @__PURE__ */ jsx(Field$2, {
							label: "Tồn kho",
							children: /* @__PURE__ */ jsx("input", {
								className: "input tabular-nums",
								type: "number",
								min: 0,
								value: stock,
								onChange: (e) => setStock(Number(e.target.value))
							})
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-11 px-6",
						children: "Thêm vào kho"
					}), flash && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: flash
					})]
				})]
			}),
			/* @__PURE__ */ jsx(Table$1, {
				head: [
					"Quà",
					"Loại",
					"Điểm",
					"Tồn kho",
					"Trạng thái",
					""
				],
				children: list.map((g) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsx(Td$1, {
						className: "font-semibold text-ink",
						children: g.name
					}),
					/* @__PURE__ */ jsx(Td$1, {
						className: "whitespace-nowrap",
						children: g.kind === "voucher" ? "Voucher" : "Quà vật lý"
					}),
					/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx("input", {
						className: "input h-9 w-28 tabular-nums",
						type: "number",
						min: 0,
						step: 500,
						value: g.cost,
						onChange: (e) => set(g.id, { cost: Number(e.target.value) }),
						"aria-label": `Điểm đổi của ${g.name}`
					}) }),
					/* @__PURE__ */ jsx(Td$1, { children: g.stock === null ? /* @__PURE__ */ jsx("span", {
						className: "text-[13px] text-muted",
						children: "Không giới hạn"
					}) : /* @__PURE__ */ jsx("input", {
						className: "input h-9 w-24 tabular-nums",
						type: "number",
						min: 0,
						value: g.stock,
						onChange: (e) => set(g.id, { stock: Number(e.target.value) }),
						"aria-label": `Tồn kho của ${g.name}`
					}) }),
					/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsx(Status$1, {
						tone: g.active ? "ok" : "off",
						children: g.active ? "Đang mở" : "Đang ẩn"
					}) }),
					/* @__PURE__ */ jsx(Td$1, { children: /* @__PURE__ */ jsxs("span", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => set(g.id, { active: !g.active }),
							className: "text-[13px] font-semibold text-brand hover:text-brand-deep",
							children: g.active ? "Ẩn" : "Hiện"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => remove(g.id),
							className: "text-[13px] font-semibold text-warn hover:underline",
							children: "Xoá"
						})]
					}) })
				] }, g.id))
			})
		]
	});
}
//#endregion
//#region src/pages/staff/CheckIn.tsx
/** S-11 Điểm danh nhân viên.
*
*  Dùng lại đúng `CheckIn` của người dân thay vì viết bản thứ hai: cùng một
*  quy tắc chuỗi 7 ngày, cùng một chỗ lưu trạng thái. Hai bản khác nhau sẽ
*  phải sửa hai chỗ mỗi lần đổi công thức thưởng.
*
*  Điểm của nhân viên là điểm nhận việc, không dùng để đổi quà — nên ô số dư
*  hiện dưới dạng liệt kê, không phải số dư như trang người dân. */
function StaffCheckIn() {
	const user = useUser();
	const [points, setPoints] = useState(0);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead$1, {
				eyebrow: "NHÂN VIÊN",
				title: "Điểm danh hằng ngày",
				body: `${user || "Bạn"} điểm danh đầu ngày để nhận điểm làm việc. Chuỗi 7 ngày, ngày thứ 7 thưởng gấp rưỡi.`
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "card flex flex-col gap-6 p-5 md:p-7 lg:flex-row lg:items-center lg:gap-10",
				children: [/* @__PURE__ */ jsx(CheckIn, {
					balance: points,
					onEarn: (n) => setPoints((p) => p + n)
				}), /* @__PURE__ */ jsxs("dl", {
					className: "flex shrink-0 flex-col gap-3 border-t border-line-soft pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10",
					children: [/* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
						className: "text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
						children: "Điểm nhận việc"
					}), /* @__PURE__ */ jsx("dd", {
						className: "mt-1 text-3xl leading-9 font-bold tabular-nums text-brand",
						children: fmt(points)
					})] }), /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("dt", {
						className: "text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
						children: "Công việc đã xử lý"
					}), /* @__PURE__ */ jsx("dd", {
						className: "mt-1 text-3xl leading-9 font-bold tabular-nums text-ink",
						children: "42"
					})] })]
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Điểm nhận việc dùng để xếp giải thưởng cuối tháng, không đổi được quà và không quy về tài khoản ngân hàng. Nếu bạn quên điểm danh một ngày thì chuỗi tính lại từ ngày 1."
			})
		]
	});
}
//#endregion
//#region src/components/admin/ui.tsx
/** Bộ component RIÊNG của khu vực quản trị.
*
*  Cố tình trùng TÊN với component trong `@/components/Portal` (PageHead, Stat,
*  Table, Td, Status, Field, Empty) nhưng là kiểm khác: đổi cái import trong
*  từng trang là xong, không phải sửa lại JSX của cả 11 trang.
*
*  Khác biệt so với bản dùng cho khu vực người dân:
*
*  |           | khu vực người dân        | console quản trị          |
*  |-----------|---------------------------|--------------------------|
*  | tiêu đề  | `.display` xanh 28px      | chữ ink 20px, xanh chỉ ở eyebrow |
*  | bảng      | trong khung bo tròn có viền| không khung, gọn, số tabular |
*  | nút       | pill bo tròn             | bo góc vừa, đều chiều cao |
*  | nhãn      | 13px đậm                | 11px uppercase xám       |
*  | badge     | pill tròn                | bo góc nhẹ               |
*
*  Quy tắc của riêng khu vực quản trị: CHỮ vẫn là chữ của trang công khai
*  (chỉ đổi cỡ và mật độ) chứ không đổi mặt chữ — đổi mặt chữ theo từng
*  khu vực thì người dùng phải học lại đọc mỗi lần chuyển trang.
*/
function PageHead({ eyebrow, title, body, action }) {
	return /* @__PURE__ */ jsxs("header", {
		className: "mb-6 flex flex-wrap items-end justify-between gap-4",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "min-w-0",
			children: [
				/* @__PURE__ */ jsx("p", {
					className: "text-[11px] font-bold tracking-[0.14em] text-brand uppercase",
					children: eyebrow
				}),
				/* @__PURE__ */ jsx("h1", {
					className: "mt-1 text-xl leading-7 font-bold tracking-tight text-ink",
					children: title
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1.5 max-w-[68ch] text-[13px] leading-5 text-muted",
					children: body
				})
			]
		}), action]
	});
}
/** Dải số liệu tổng quan. Lõi trắng trong vỏ mint (double-bezel) để sáng và có
*  chủ đề mà không thành một tấm xanh đậm nặng nề. */
function StatRow({ children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "mb-6 rounded-2xl bg-mint/30 p-1.5 ring-1 ring-brand/12",
		children: /* @__PURE__ */ jsx("div", {
			className: `grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-[1fr_0.8fr_1.15fr_1.5fr] rounded-xl bg-white px-5 py-6 shadow-[0_24px_48px_-28px_rgba(15,31,21,0.26)]`,
			children
		})
	});
}
function Stat({ label, value, unit, note }) {
	return /* @__PURE__ */ jsxs("div", {
		className: "min-w-0",
		children: [
			/* @__PURE__ */ jsx("p", {
				className: "text-[11px] font-semibold tracking-[0.1em] text-brand uppercase",
				children: label
			}),
			/* @__PURE__ */ jsxs("p", {
				className: "mt-1.5 flex items-baseline gap-1.5 text-[26px] leading-9 font-bold tracking-tight text-ink xl:text-[28px]",
				children: [/* @__PURE__ */ jsx("span", {
					className: "tabular-nums",
					children: value
				}), unit && /* @__PURE__ */ jsx("span", {
					className: "text-sm font-semibold text-brand-deep",
					children: unit
				})]
			}),
			note && /* @__PURE__ */ jsx("p", {
				className: "mt-1 text-[13px] leading-5 text-muted",
				children: note
			})
		]
	});
}
/** Bảng dữ liệu của console: KHÔNG bọc khung bo tròn như bảng của khu vực
*  người dân. Bảng console thường dài và nhiều cột, viền bao quanh chỉ thêm
*  một vòng nữa mà không giúp gì — dùng đường kẻ hàng ngang để mắt đọc theo
*  cột dễ hơn. */
function Table({ head, children }) {
	return /* @__PURE__ */ jsx("div", {
		className: "overflow-x-auto",
		children: /* @__PURE__ */ jsxs("table", {
			className: "w-full min-w-[640px] border-collapse text-left text-sm",
			children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsx("tr", {
				className: "border-b border-line",
				children: head.map((h) => /* @__PURE__ */ jsx("th", {
					scope: "col",
					className: "px-3 py-2.5 text-[10px] font-bold tracking-[0.1em] text-muted uppercase",
					children: h
				}, h))
			}) }), /* @__PURE__ */ jsx("tbody", {
				className: "divide-y divide-line-soft",
				children
			})]
		})
	});
}
function Td({ children, className = "" }) {
	return /* @__PURE__ */ jsx("td", {
		className: `px-3 py-2.5 align-middle text-[13px] text-body ${className}`,
		children
	});
}
/** Nhãn trạng thái. Bo góc nhẹ, chữ 11px — dùng bo tròn pill ở bảng console thì
*  nhìn như bảng giá bán lẻ, không phải công cụ vận hành. */
function Status({ tone, children }) {
	const cls = {
		todo: "bg-surface-3 text-ink",
		wait: "bg-brand/12 text-brand-deep",
		ok: "bg-brand text-white",
		off: "bg-surface-2 text-muted"
	}[tone];
	return /* @__PURE__ */ jsx("span", {
		className: `inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cls}`,
		children
	});
}
/** Trường biểu mẫu: nhãn uppercase 11px như tiêu đề cột của bảng, để cả trang
*  nhìn như một hệ thống. */
function Field({ label, hint, children }) {
	return /* @__PURE__ */ jsxs("label", {
		className: "flex flex-col gap-1.5",
		children: [
			/* @__PURE__ */ jsx("span", {
				className: "text-[11px] font-bold tracking-[0.1em] text-muted uppercase",
				children: label
			}),
			children,
			hint && /* @__PURE__ */ jsx("span", {
				className: "text-[12px] leading-5 text-muted",
				children: hint
			})
		]
	});
}
/** Biểu đồ cột đứng, cho dãy số theo thời gian.
*
*  Vẽ bằng CSS chứ không cột SVG: cột là hình chữ nhật, CSS lo một việc mà SVG
*  phải tự tính toạ độ cho từng điểm. Thêm tháng sau chỉ thêm phần tử vào mảng.
*
*  `value` nhận kèm số gốc chứ không nhận phần trăm — người đọc biểu đồ phải
*  thấy đúng con số, không phải tỷ lệ quy về đỉnh. Tỷ lệ chỉ dùng cho CHIỀU
*  CAO thanh, và chiều cao đó không có nghĩa nếu không ghi số tuyệt đối. */
function ColumnChart({ data, format = (n) => fmtNum(n), height = 168 }) {
	const peak = Math.max(...data.map((d) => d.value));
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("div", {
		className: "flex items-end gap-2",
		style: { height },
		children: data.map((d) => /* @__PURE__ */ jsxs("div", {
			className: "flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5",
			children: [/* @__PURE__ */ jsx("span", {
				className: "text-center text-[11px] font-semibold tabular-nums text-muted",
				children: format(d.value)
			}), /* @__PURE__ */ jsx("span", {
				className: "w-full rounded-t-md bg-brand",
				style: { height: `${Math.max(d.value / peak * 100, 1.5)}%` }
			})]
		}, d.label))
	}), /* @__PURE__ */ jsx("div", {
		className: "mt-2 flex gap-2 border-t border-line-soft pt-2",
		children: data.map((d) => /* @__PURE__ */ jsx("span", {
			className: "min-w-0 flex-1 truncate text-center text-[11px] text-muted",
			children: d.label
		}, d.label))
	})] });
}
var fmtNum = (n) => n.toLocaleString("vi-VN");
//#endregion
//#region src/pages/admin/Home.tsx
/** A-01 Dashboard và thống kê.
*
*  Thứ tự: nhìn một giây ra tổng quan → đọc việc đang chờ mình quyết định →
*  đào vào xu hướng. Trang quản trị mở ra bằng một biểu đồ đẹp thì người quản
*  trị không biết phải làm gì.
*
*  Ba thay đổi so với bản đầu, cả ba đều là điều luật thiết kế cấm:
*
*  1. Bỏ dãy 4 thẻ số liệu giống hệt nhau (hero-metric template) — thay bằng
*     `StatRow` kẻ ngang, số liệu đứng thẳng hàng như báo cáo tài chính.
*  2. Bỏ biểu đồ cột: nó và bảng bên dưới in ra CÙNG 6 con số, tức hai cách
*     biểu diễn một dữ liệu. Giữ bảng và vẽ thanh nhỏ trong từng dòng — một
*     biểu diễn, số chính xác đọc được, thêm tháng sau không phải vẽ lại.
*  3. Thanh bên trong ô chứ không phải 4 thẻ tách rời: số việc tồn đọng có
*     thứ tự, nên danh sách phải cho thấy phần đóng góp của từng loại so với
*     tổng, chứ không phải 4 hộp cùng cỡ.
*
*  Biểu đồ cũ còn animate `height` — thuộc tính layout, mỗi khung hình phải
*  tính lại bố cục. Nay thanh có chiều rộng tĩnh, không animation: số liệu
*  không phải chuyện trang trí để chờ động. */
function AdminHome() {
	const s = STATS;
	/** Việc tồn đọng, sắp nhiều trước — tổng tính từ dữ liệu chứ không chốt số. */
	const queue = [
		{
			to: "/staff/ai-review",
			label: "Ảnh AI nhận diện sai",
			owner: "Nhân viên AI",
			n: s.pending.aiCases
		},
		{
			to: "/staff/applications",
			label: "Hồ sơ đối tác thu mua",
			owner: "Nhân viên đối tác",
			n: s.pending.applications
		},
		{
			to: "/staff/complaints",
			label: "Khiếu nại giao dịch",
			owner: "Nhân viên hỗ trợ",
			n: s.pending.complaints
		},
		{
			to: "/admin/blog",
			label: "Bài Blog chờ duyệt",
			owner: "Bạn (Admin)",
			n: s.pending.posts
		}
	].sort((a, b) => b.n - a.n);
	const queueTotal = queue.reduce((t, x) => t + x.n, 0);
	const backlog = queue.map((b) => ({
		...b,
		share: b.n / queueTotal
	}));
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-8",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "QUẢN TRỊ",
				title: "Dashboard và thống kê",
				body: "Tổng quan toàn hệ thống. Dùng để ra quyết định cấu hình, không phải để báo cáo ra ngoài.",
				action: /* @__PURE__ */ jsx(Link, {
					to: "/admin/reports",
					className: "btn-outline h-11 shrink-0 px-5",
					children: "Xuất báo cáo"
				})
			}),
			/* @__PURE__ */ jsxs(StatRow, { children: [
				/* @__PURE__ */ jsx(Stat, {
					label: "Người dùng",
					value: fmtInt(s.users)
				}),
				/* @__PURE__ */ jsx(Stat, {
					label: "Cơ sở thu mua",
					value: fmtInt(s.recyclers)
				}),
				/* @__PURE__ */ jsx(Stat, {
					label: "Khối lượng 30 ngày",
					value: fmtInt(s.volume30d),
					unit: "kg"
				}),
				/* @__PURE__ */ jsx(Stat, {
					label: "Giá trị 30 ngày",
					value: fmtVnd(s.gross30d)
				})
			] }),
			/* @__PURE__ */ jsxs("p", {
				className: "text-sm text-body",
				children: [
					"Trong 30 ngày đó, EcoLink thu phí nền tảng",
					" ",
					/* @__PURE__ */ jsx("b", {
						className: "tabular-nums text-ink",
						children: fmtVnd(s.fee30d)
					}),
					" từ",
					" ",
					/* @__PURE__ */ jsx("b", {
						className: "tabular-nums text-ink",
						children: fmtInt(s.handovers30d)
					}),
					" giao dịch hoàn tất."
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
				children: [/* @__PURE__ */ jsx("h2", {
					className: "text-lg leading-7 font-bold tracking-tight text-ink",
					children: "Việc đang chờ xử lý"
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted",
					children: "Cùng hàng đợi mà nhân viên thấy. Loại nào không giảm được là quy trình đang nghẽn."
				})]
			}), /* @__PURE__ */ jsx("ul", {
				className: "mt-4 divide-y divide-line-soft border-y border-line-soft",
				children: backlog.map((b) => /* @__PURE__ */ jsxs("li", {
					className: "flex flex-wrap items-center gap-x-5 gap-y-2 py-3.5",
					children: [
						/* @__PURE__ */ jsxs("span", {
							className: "w-[280px] max-w-full shrink-0",
							children: [/* @__PURE__ */ jsx("span", {
								className: "block text-sm font-semibold text-ink",
								children: b.label
							}), /* @__PURE__ */ jsx("span", {
								className: "block text-[13px] text-muted",
								children: b.owner
							})]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "h-1.5 w-[170px] max-w-full shrink-0 overflow-hidden rounded-full bg-surface-3",
							children: /* @__PURE__ */ jsx("span", {
								className: "block h-full rounded-full bg-brand",
								style: { width: `${Math.round(b.share * 100)}%` }
							})
						}),
						/* @__PURE__ */ jsx("span", { className: "flex-1" }),
						/* @__PURE__ */ jsx("span", {
							className: "w-10 shrink-0 text-right text-lg leading-7 font-bold tabular-nums text-ink",
							children: b.n
						}),
						/* @__PURE__ */ jsx(Link, {
							to: b.to,
							className: "w-[68px] shrink-0 text-right text-[13px] font-semibold text-brand transition-colors hover:text-brand-deep",
							children: "Xử lý →"
						})
					]
				}, b.to))
			})] }),
			/* @__PURE__ */ jsx("section", { children: /* @__PURE__ */ jsxs(Chart, {
				title: "Giao dịch 6 tháng gần nhất",
				note: "Cột cao nhất là tháng T9. Bảng dưới cho khối lượng, bình quân mỗi giao dịch và tốc độ tăng.",
				children: [/* @__PURE__ */ jsx(ColumnChart, { data: s.trend.map((t) => ({
					label: t.month,
					value: t.handovers
				})) }), /* @__PURE__ */ jsx("div", {
					className: "mt-5",
					children: /* @__PURE__ */ jsx(Table, {
						head: [
							"Tháng",
							"Giao dịch",
							"Tăng so với tháng trước",
							"Khối lượng (kg)",
							"Bình quân mỗi giao dịch"
						],
						children: s.trend.map((t, i) => {
							const prev = s.trend[i - 1];
							const growth = prev ? (t.handovers - prev.handovers) / prev.handovers * 100 : null;
							return /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx(Td, {
									className: "font-semibold whitespace-nowrap text-ink",
									children: t.month
								}),
								/* @__PURE__ */ jsx(Td, {
									className: "tabular-nums whitespace-nowrap",
									children: fmtInt(t.handovers)
								}),
								/* @__PURE__ */ jsx(Td, {
									className: "tabular-nums whitespace-nowrap",
									children: growth === null ? /* @__PURE__ */ jsx("span", {
										className: "text-muted",
										children: "—"
									}) : /* @__PURE__ */ jsxs("span", {
										className: growth >= 0 ? "text-brand-deep" : "text-warn",
										children: [
											growth >= 0 ? "+" : "",
											growth.toFixed(1),
											"%"
										]
									})
								}),
								/* @__PURE__ */ jsx(Td, {
									className: "tabular-nums whitespace-nowrap",
									children: fmtInt(t.volume)
								}),
								/* @__PURE__ */ jsxs(Td, {
									className: "tabular-nums whitespace-nowrap",
									children: [Math.round(t.volume / t.handovers), " kg"]
								})
							] }, t.month);
						})
					})
				})]
			}) }),
			/* @__PURE__ */ jsx("section", { children: /* @__PURE__ */ jsx(Chart, {
				title: "AI quét đúng và khiếu nại sai, theo nhóm rác",
				note: "Hai số này lệch tầng vài chục nghìn so với vài trăm nên đặt chung một trục là vô nghĩa: cột khiếu nại sẽ không còn gì để nhìn. Tách hai dải, cùng thang đo, mỗi dải một nhãn.",
				to: "/staff/ai-review",
				cta: "Ảnh AI sai",
				children: /* @__PURE__ */ jsxs("div", {
					className: "grid gap-6 lg:grid-cols-2",
					children: [/* @__PURE__ */ jsx(Scale, {
						title: "AI nhận diện đúng",
						unit: "lượt",
						rows: s.aiByGroup.map((g) => ({
							label: g.group,
							value: g.correct,
							note: `${(g.correct / g.scans * 100).toFixed(1)}% chính xác`
						}))
					}), /* @__PURE__ */ jsx(Scale, {
						title: "Khiếu nại sai (báo nhầm, AI đúng)",
						unit: "lượt",
						rows: s.aiByGroup.map((g) => ({
							label: g.group,
							value: g.falseReports,
							note: `${(g.falseReports / g.scans * 100).toFixed(1)}% tổng lượt quét`
						})).sort((a, b) => b.value - a.value)
					})]
				})
			}) }),
			/* @__PURE__ */ jsx("section", { children: /* @__PURE__ */ jsx(Chart, {
				title: "Độ chính xác nhận diện theo lớp rác",
				note: `Đo trên tập kiểm chứng, trung bình toàn hệ thống ${DATASET.accuracy}%. Lớp dưới đường cơ sở là lớm đang mất tiền và mất uy tín.`,
				to: "/staff/dataset",
				cta: "Tập dữ liệu",
				children: /* @__PURE__ */ jsx("ul", {
					className: "flex flex-col",
					children: DATASET.byClass.map((c) => {
						const below = c.accuracy < DATASET.accuracy;
						return /* @__PURE__ */ jsxs("li", {
							className: "grid grid-cols-[minmax(0,132px)_1fr_92px] items-center gap-3 py-1.5",
							children: [
								/* @__PURE__ */ jsx("span", {
									className: "truncate text-[13px] text-body",
									children: c.label
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "relative h-2 overflow-hidden rounded-full bg-surface-3",
									children: [/* @__PURE__ */ jsx("span", {
										className: "absolute inset-y-0 left-0 bg-[linear-gradient(90deg,var(--color-mint),var(--color-brand))]",
										style: { width: `${c.accuracy}%` }
									}), /* @__PURE__ */ jsx("span", {
										className: "absolute inset-y-0 w-px bg-ink/45",
										style: { left: `${DATASET.accuracy}%` }
									})]
								}),
								/* @__PURE__ */ jsxs("span", {
									className: "text-right text-[13px] font-semibold tabular-nums text-ink",
									children: [c.accuracy, "%"]
								}),
								/* @__PURE__ */ jsx("span", {
									className: "sr-only",
									children: below ? "Dưới trung bình toàn hệ thống" : "Bằng hoặc trên trung bình"
								})
							]
						}, c.label);
					})
				})
			}) })
		]
	});
}
/** Dải thanh ngang theo một thang đo DÙNG CHUNG cho mọi dải trên trang.
*
*  `AI_SCAN_PEAK` là mẫu số chung, không phải max của từng dải: hai dải phải
*  so được với nhau, nếu mỗi dải tự chuẩn hoá thì cột ngắn nhất trông dài
*  bằng cột dài nhất và con số phải mới là nơi duy nhất để tin — đúng thứ mà
*  biểu đồ sinh ra để bỏ. */
function Scale({ title, unit, rows }) {
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsx("h3", {
		className: "text-[11px] font-bold tracking-[0.1em] text-muted uppercase",
		children: title
	}), /* @__PURE__ */ jsx("ul", {
		className: "mt-2",
		children: rows.map((r) => /* @__PURE__ */ jsxs("li", {
			className: "grid grid-cols-[minmax(0,86px)_1fr_92px] items-center gap-x-3 gap-y-0.5 py-1.5",
			children: [
				/* @__PURE__ */ jsx("span", {
					className: "truncate text-[13px] text-body",
					children: r.label
				}),
				/* @__PURE__ */ jsx("span", {
					className: "h-2.5 overflow-hidden rounded-full bg-surface-3",
					children: /* @__PURE__ */ jsx("span", {
						className: "block h-full rounded-full bg-brand",
						style: { width: `${Math.max(r.value / AI_SCAN_PEAK * 100, .8)}%` }
					})
				}),
				/* @__PURE__ */ jsx("span", {
					className: "text-right text-[13px] font-semibold tabular-nums text-ink",
					children: fmtInt(r.value)
				}),
				/* @__PURE__ */ jsxs("span", {
					className: "col-start-2 col-end-3 text-[11px] tabular-nums text-muted",
					children: [
						r.note,
						" · ",
						unit
					]
				})
			]
		}, r.label))
	})] });
}
/** Khung biểu đồ: tiêu đề + chú giải + đường tới màn hình quản lý. Cùng một
*  bố cục cho cả ba biểu đồ — lệch bố cục thì ba khối trông như ba sản phẩm
*  khác nhau. */
function Chart({ title, note, to, cta, children }) {
	return /* @__PURE__ */ jsxs("div", { children: [/* @__PURE__ */ jsxs("div", {
		className: "flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1",
		children: [/* @__PURE__ */ jsx("h2", {
			className: "text-lg leading-7 font-bold tracking-tight text-ink",
			children: title
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-baseline gap-x-6 gap-y-1",
			children: [/* @__PURE__ */ jsx("p", {
				className: "max-w-[52ch] text-sm text-muted",
				children: note
			}), to && cta && /* @__PURE__ */ jsxs(Link, {
				to,
				className: "text-[13px] font-semibold text-brand whitespace-nowrap transition-colors hover:text-brand-deep",
				children: [cta, " →"]
			})]
		})]
	}), /* @__PURE__ */ jsx("div", {
		className: "mt-4 rounded-xl border border-line bg-white p-5",
		children
	})] });
}
//#endregion
//#region src/pages/admin/Reports.tsx
var SHEETS = {
	users: {
		label: "Người dùng và cơ sở thu mua",
		head: [
			"Mã",
			"Tên",
			"Email",
			"Vai trò",
			"Khu vực",
			"Ngày tham gia",
			"Giao dịch"
		],
		rows: () => ACCOUNTS.map((a) => ({
			"Mã": a.id,
			"Tên": a.name,
			"Email": a.email,
			"Vai trò": a.role === "user" ? "Người dân" : "Cơ sở thu mua",
			"Khu vực": a.area,
			"Ngày tham gia": a.joined,
			"Giao dịch": a.deals
		}))
	},
	handovers: {
		label: "Yêu cầu bàn giao",
		head: [
			"Mã",
			"Đối tác",
			"Ngày",
			"Khung giờ",
			"Trạng thái"
		],
		rows: () => MY_HANDOVERS.map((h) => ({
			"Mã": h.id,
			"Đối tác": h.recycler,
			"Ngày": h.date,
			"Khung giờ": h.slot,
			"Trạng thái": h.status
		}))
	},
	cashflow: {
		label: "Dòng tiền",
		head: [
			"Ngày",
			"Mã giao dịch",
			"Mã bàn giao",
			"Loại",
			"Số tiền",
			"Đối tác"
		],
		rows: () => FLOWS.map((f) => ({
			"Ngày": f.date,
			"Mã giao dịch": f.id,
			"Mã bàn giao": f.handoverId,
			"Loại": f.kind,
			"Số tiền": f.amount,
			"Đối tác": f.party
		}))
	},
	posts: {
		label: "Bài Blog",
		head: [
			"Mã",
			"Tiêu đề",
			"Tác giả",
			"Ngày",
			"Trạng thái"
		],
		rows: () => POSTS.map((p) => ({
			"Mã": p.id,
			"Tiêu đề": p.title,
			"Tác giả": p.author,
			"Ngày": p.date,
			"Trạng thái": p.status
		}))
	}
};
/** Một ô CSV cần nháy kép nếu chứa dấu phẩy, xuống dòng hoặc nháy kép —
*  tiêu đề bài blog có dấu phẩy là chuyện thường, không escape thì file ra
*  cột lệch hàng. */
var cell = (v) => /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, "\"\"")}"` : String(v);
function toCsv(head, rows) {
	return [head, ...rows.map((r) => head.map((h) => r[h]))].map((line) => line.map(cell).join(",")).join("\r\n");
}
/** A-02 Xuất báo cáo dữ liệu (CSV).
*
*  Xuất CSV chứ không xuất Excel (.xlsx): gói đọc/ghi xlsx cần thêm dependency
*  và vài trăm KB vào bundle, còn CSV mở được bằng Excel, Sheets và LibreOffice
*  mà không cần cài gì. Nếu sau này thật sự cần định dạng xlsx thì lúc đó thêm.
*
*  BOM `\uFEFF` ở đầu file là bắt buộc: không có nó thì Excel trên Windows mở
*  tiếng Việt ra mojibake. */
function download(sheet) {
	const { head, rows } = SHEETS[sheet];
	const blob = new Blob(["﻿" + toCsv(head, rows())], { type: "text/csv;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `ecolink-${sheet}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv`;
	a.click();
	URL.revokeObjectURL(url);
}
function Reports() {
	const [flash, setFlash] = useState("");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "BÁO CÁO",
				title: "Xuất báo cáo dữ liệu",
				body: "Tải dữ liệu ra file CSV để mở bằng Excel, Google Sheets hoặc LibreOffice. Cột và hàng giữ nguyên như bảng trên màn hình."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Người dùng",
						value: fmtInt(STATS.users)
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Giao dịch 30 ngày",
						value: fmtInt(STATS.handovers30d)
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Giá trị 30 ngày",
						value: fmtVnd(STATS.gross30d)
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Phí thu được",
						value: fmtVnd(STATS.fee30d)
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "card flex flex-col gap-4 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx(Field, {
						label: "Khoảng thời gian",
						hint: "Chỉ dùng để ghi vào tên file; dữ liệu mẫu không chia theo ngày.",
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap gap-2",
							children: [/* @__PURE__ */ jsx("input", {
								className: "input w-44",
								type: "date",
								defaultValue: "2026-09-01",
								"aria-label": "Từ ngày"
							}), /* @__PURE__ */ jsx("input", {
								className: "input w-44",
								type: "date",
								defaultValue: "2026-09-30",
								"aria-label": "Đến ngày"
							})]
						})
					}),
					/* @__PURE__ */ jsx("div", {
						className: "border-t border-line-soft pt-4",
						children: /* @__PURE__ */ jsx("ul", {
							className: "grid gap-3 sm:grid-cols-2",
							children: Object.entries(SHEETS).map(([key, s]) => /* @__PURE__ */ jsxs("li", {
								className: "flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3",
								children: [/* @__PURE__ */ jsxs("div", {
									className: "min-w-0",
									children: [/* @__PURE__ */ jsx("p", {
										className: "text-sm font-semibold text-ink",
										children: s.label
									}), /* @__PURE__ */ jsxs("p", {
										className: "mt-0.5 text-[13px] text-muted",
										children: [
											s.head.length,
											" cột · ",
											s.rows().length,
											" dòng"
										]
									})]
								}), /* @__PURE__ */ jsx("button", {
									type: "button",
									onClick: () => {
										download(key);
										setFlash(`Đã tải ${s.label.toLowerCase()} về máy.`);
									},
									className: "btn-outline h-10 shrink-0 px-4 text-[13px]",
									children: "Tải CSV"
								})]
							}, key))
						})
					}),
					flash && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: flash
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsx("h2", {
					className: "text-lg leading-7 font-bold tracking-tight text-ink",
					children: "Xem trước dữ liệu dòng tiền"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-muted",
					children: "Xem trước đúng những gì file CSV sẽ chứa, gồm cả dấu phẩy trong nội dung mà Excel có thể bỏ sót."
				}),
				/* @__PURE__ */ jsx("div", {
					className: "mt-4",
					children: /* @__PURE__ */ jsx(Table, {
						head: [
							"Ngày",
							"Mã bàn giao",
							"Loại",
							"Số tiền"
						],
						children: SHEETS.cashflow.rows().map((r, i) => /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx(Td, {
								className: "tabular-nums whitespace-nowrap",
								children: r["Ngày"]
							}),
							/* @__PURE__ */ jsx(Td, {
								className: "tabular-nums whitespace-nowrap",
								children: r["Mã bàn giao"]
							}),
							/* @__PURE__ */ jsx(Td, {
								className: "whitespace-nowrap",
								children: r["Loại"]
							}),
							/* @__PURE__ */ jsx(Td, {
								className: "tabular-nums",
								children: fmtVnd(Number(r["Số tiền"]))
							})
						] }, i))
					})
				})
			] })
		]
	});
}
//#endregion
//#region src/pages/admin/StaffAccounts.tsx
/** A-03 Quản lý tài khoản nhân viên.
*
*  Không cho nhân viên tự khoá chính mình: người đang đăng nhập mà bị khoá thì
*  mất đường vào hệ thống cho tới khi có Admin khác sửa. */
function StaffAccounts() {
	const [list, setList] = useState(STAFF);
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [flash, setFlash] = useState("");
	const toggle = (id) => setList((ls) => ls.map((s) => s.id === id ? {
		...s,
		status: s.status === "active" ? "locked" : "active"
	} : s));
	const remove = (s) => {
		if (!window.confirm(`Xoá tài khoản nhân viên ${s.name}?`)) return;
		setList((ls) => ls.filter((x) => x.id !== s.id));
		setFlash(`Đã xoá ${s.name}.`);
	};
	const add = (e) => {
		e.preventDefault();
		if (name.trim().length < 3) {
			setFlash("Cần họ tên nhân viên trước khi tạo tài khoản.");
			return;
		}
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
			setFlash("Email chưa đúng định dạng, nhân viên cần email để đặt lại mật khẩu.");
			return;
		}
		const id = `NV-${String(list.length + 1).padStart(2, "0")}`;
		setList((ls) => [...ls, {
			id,
			name: name.trim(),
			email: email.trim(),
			perms: [],
			status: "active"
		}]);
		setName("");
		setEmail("");
		setFlash(`Đã tạo ${id}. Sang trang phân quyền cấp quyền cụ thể cho nhân viên này.`);
	};
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "QUẢN TRỊ",
				title: "Tài khoản nhân viên",
				body: "Tạo, khoá và xoá tài khoản nhân viên. Tài khoản mới không có quyền nào cho tới khi bạn cấp ở trang phân quyền."
			}),
			/* @__PURE__ */ jsxs("form", {
				onSubmit: add,
				noValidate: true,
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [/* @__PURE__ */ jsxs("div", {
					className: "grid gap-5 sm:grid-cols-2",
					children: [/* @__PURE__ */ jsx(Field, {
						label: "Họ và tên",
						children: /* @__PURE__ */ jsx("input", {
							className: "input",
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "Nguyễn Văn A"
						})
					}), /* @__PURE__ */ jsx(Field, {
						label: "Email công việc",
						children: /* @__PURE__ */ jsx("input", {
							className: "input",
							type: "email",
							value: email,
							onChange: (e) => setEmail(e.target.value),
							placeholder: "ten@ecolink.vn"
						})
					})]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-11 px-6",
						children: "Tạo tài khoản"
					}), flash && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: flash
					})]
				})]
			}),
			/* @__PURE__ */ jsx(Table, {
				head: [
					"Mã",
					"Họ tên",
					"Email",
					"Số quyền",
					"Trạng thái",
					""
				],
				children: list.map((s) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsx(Td, {
						className: "tabular-nums whitespace-nowrap",
						children: s.id
					}),
					/* @__PURE__ */ jsx(Td, {
						className: "font-semibold text-ink",
						children: s.name
					}),
					/* @__PURE__ */ jsx(Td, { children: s.email }),
					/* @__PURE__ */ jsx(Td, {
						className: "tabular-nums",
						children: s.perms.length
					}),
					/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(Status, {
						tone: s.status === "active" ? "ok" : "off",
						children: s.status === "active" ? "Hoạt động" : "Đã khoá"
					}) }),
					/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsxs("span", {
						className: "flex gap-3",
						children: [/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => toggle(s.id),
							className: "text-[13px] font-semibold text-warn hover:underline",
							children: s.status === "active" ? "Khoá" : "Mở khoá"
						}), /* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => remove(s),
							className: "text-[13px] font-semibold text-warn hover:underline",
							children: "Xoá"
						})]
					}) })
				] }, s.id))
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Nhân viên đã gán quyền sẽ mất toàn bộ quyền khi bị khoá. Xoá tài khoản không xoá lịch sử công việc đã ghi nhận trong báo cáo."
			})
		]
	});
}
//#endregion
//#region src/pages/admin/Permissions.tsx
/** A-04 Phân quyền nhân viên.
*
*  Nhân viên ở đây là danh sách 3 người, quyền 7 mã — checkbox gốc của trình
*  duyệt là đủ, không cần bảng quyền riêng hay hệ thống vai trò riêng. Vài
*  trăm nhân viên thì mới cần bảng quyền chi tiết.
*
*  Ô "toàn quyền" ghi rõ trạng thái chứ không dùng màu: nhân viên không có
*  bất kỳ quyền nào trông giống nhân viên có toàn quyền khi quyền chưa tải. */
function Permissions() {
	const [list, setList] = useState(STAFF);
	const [flash, setFlash] = useState("");
	const flip = (id, perm) => setList((ls) => ls.map((s) => s.id === id ? {
		...s,
		perms: s.perms.includes(perm) ? s.perms.filter((p) => p !== perm) : [...s.perms, perm]
	} : s));
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "QUẢN TRỊ",
				title: "Phân quyền nhân viên",
				body: "Mỗi quyền tương ứng một nhóm màn hình vận hành. Nhân viên không có quyền nào sẽ đăng nhập được nhưng không thấy việc nào để xử lý."
			}),
			/* @__PURE__ */ jsx("div", {
				className: "card overflow-x-auto",
				children: /* @__PURE__ */ jsxs("table", {
					className: "w-full min-w-[720px] border-collapse text-left text-sm",
					children: [/* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", {
						className: "border-b border-line bg-surface-2",
						children: [/* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-4 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
							children: "Nhân viên"
						}), PERMS.map((p) => /* @__PURE__ */ jsx("th", {
							scope: "col",
							className: "px-3 py-2.5 text-[11px] font-semibold tracking-[0.08em] text-muted uppercase",
							children: p.label
						}, p.id))]
					}) }), /* @__PURE__ */ jsx("tbody", {
						className: "divide-y divide-line-soft",
						children: list.map((s) => /* @__PURE__ */ jsxs("tr", { children: [/* @__PURE__ */ jsxs(Td, {
							className: "font-semibold text-ink whitespace-nowrap",
							children: [s.name, /* @__PURE__ */ jsx("span", {
								className: "block text-[12px] font-normal text-muted",
								children: s.id
							})]
						}), PERMS.map((p) => /* @__PURE__ */ jsx("td", {
							className: "px-3 py-3",
							children: /* @__PURE__ */ jsx("input", {
								type: "checkbox",
								className: "size-4 accent-brand",
								checked: s.perms.includes(p.id),
								onChange: () => flip(s.id, p.id),
								"aria-label": `${p.label} cho ${s.name}`
							})
						}, p.id))] }, s.id))
					})]
				})
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-4",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => {
							setList((ls) => ls.map((s) => ({
								...s,
								perms: PERMS.map((p) => p.id)
							})));
							setFlash("Đã cấp toàn bộ quyền cho tất cả nhân viên trong danh sách.");
						},
						className: "btn-ghost h-11 px-5",
						children: "Cấp toàn quyền cho tất cả"
					}),
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => {
							setList((ls) => ls.map((s) => ({
								...s,
								perms: []
							})));
							setFlash("Đã thu hồi toàn bộ quyền. Chỉ dùng khi cần reset sạch.");
						},
						className: "btn-ghost h-11 px-5 text-warn",
						children: "Thu hồi toàn bộ quyền"
					}),
					flash && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: flash
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Trạng thái hiện tại"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table, {
					head: [
						"Nhân viên",
						"Tài khoản",
						"Số quyền",
						"Tóm tắt"
					],
					children: list.map((s) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td, {
							className: "font-semibold text-ink",
							children: s.name
						}),
						/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(Status, {
							tone: s.status === "active" ? "ok" : "off",
							children: s.status === "active" ? "Hoạt động" : "Đã khoá"
						}) }),
						/* @__PURE__ */ jsxs(Td, {
							className: "tabular-nums",
							children: [
								s.perms.length,
								" / ",
								PERMS.length
							]
						}),
						/* @__PURE__ */ jsx(Td, { children: s.perms.length === 0 ? "Chưa có quyền nào" : s.perms.length === PERMS.length ? "Toàn quyền" : PERMS.filter((p) => s.perms.includes(p.id)).map((p) => p.label).join(", ") })
					] }, s.id))
				})
			})] }),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Quyền ở đây chỉ ẩn hiện màn hình. Backend vẫn phải tự kiểm tra quyền theo từng API — nếu không, người dùng gọi thẳng URL là vẫn làm được việc bị cấm."
			})
		]
	});
}
//#endregion
//#region src/pages/admin/BlogReview.tsx
/** A-09 Duyệt / hủy bài đăng Blog.
*
*  Hủy bài luôn bắt buộc có lý do: tác giả đã viết và chờ, họ cần biết sửa
*  chỗ nào thay vì thấy bài biến mất. Cùng lý do với S-04 từ chối hồ sơ. */
function BlogReview() {
	const [list, setList] = useState(POSTS);
	const [flash, setFlash] = useState("");
	const decide = (id, ok) => {
		let note;
		if (!ok) {
			const reason = window.prompt(`Hủy bài ${id}. Lý do (tác giả sẽ thấy lý do này):`);
			if (!reason?.trim()) return;
			note = reason.trim();
		}
		setList((ls) => ls.map((p) => p.id === id ? {
			...p,
			status: ok ? "published" : "rejected",
			note
		} : p));
		setFlash(ok ? `${id} đã xuất bản, hiện công khai ngay.` : `${id} đã bị hủy với lý do "${note}".`);
	};
	const pending = list.filter((p) => p.status === "pending");
	const done = list.filter((p) => p.status !== "pending");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "DUYỆT NỘI DUNG",
				title: "Duyệt bài Blog",
				body: "Chỉ bài đã duyệt mới hiện công khai. Hủy bài thì phải nói lý do để tác giả sửa được, không biến mất im lặng."
			}),
			flash && /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "text-[13px] font-semibold text-brand",
				children: flash
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("h2", {
				className: "text-base font-bold text-ink",
				children: [
					"Chờ duyệt (",
					pending.length,
					")"
				]
			}), pending.length === 0 ? /* @__PURE__ */ jsx("p", {
				className: "card mt-3 px-5 py-8 text-center text-sm text-muted",
				children: "Không có bài nào chờ duyệt."
			}) : /* @__PURE__ */ jsx("ul", {
				className: "mt-3 flex flex-col gap-4",
				children: pending.map((p) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-3 p-5",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap items-start justify-between gap-3",
							children: [/* @__PURE__ */ jsxs("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ jsx("p", {
									className: "text-[13px] font-semibold text-brand",
									children: p.id
								}), /* @__PURE__ */ jsx("h2", {
									className: "text-base leading-6 font-bold text-ink",
									children: p.title
								})]
							}), /* @__PURE__ */ jsx(Status, {
								tone: "wait",
								children: "Chờ duyệt"
							})]
						}),
						/* @__PURE__ */ jsx("p", {
							className: "text-sm leading-6 text-body",
							children: p.excerpt
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-[13px] text-muted",
							children: [
								p.author,
								" · ",
								p.date
							]
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "flex flex-wrap gap-3 border-t border-line-soft pt-4",
							children: [/* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => decide(p.id, true),
								className: "btn-primary h-11 px-6",
								children: "Duyệt và xuất bản"
							}), /* @__PURE__ */ jsx("button", {
								type: "button",
								onClick: () => decide(p.id, false),
								className: "btn-ghost h-11 px-5",
								children: "Hủy bài"
							})]
						})
					]
				}, p.id))
			})] }),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Đã xử lý"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-3",
				children: /* @__PURE__ */ jsx(Table, {
					head: [
						"Mã",
						"Tiêu đề",
						"Tác giả",
						"Kết quả",
						"Lý do"
					],
					children: done.map((p) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td, {
							className: "tabular-nums whitespace-nowrap",
							children: p.id
						}),
						/* @__PURE__ */ jsx(Td, {
							className: "font-semibold text-ink",
							children: p.title
						}),
						/* @__PURE__ */ jsx(Td, {
							className: "whitespace-nowrap",
							children: p.author
						}),
						/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(Status, {
							tone: p.status === "published" ? "ok" : "off",
							children: p.status === "published" ? "Đã xuất bản" : "Đã hủy"
						}) }),
						/* @__PURE__ */ jsx(Td, { children: p.note ?? "—" })
					] }, p.id))
				})
			})] }),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Bài đã xuất bản xuất hiện ở trang Blog công khai. Hủy một bài đang chạy sẽ gỡ nó khỏi trang công khai ngay lập tức."
			})
		]
	});
}
//#endregion
//#region src/pages/admin/Categories.tsx
/** A-05 Quản lý danh mục rác hệ thống.
*
*  Đây là bảng nguồn: giá và luật xử lý ở đây được đọc bởi `/waste` (tra cứu
*  của người dân), `/guidance` (hướng dẫn phân loại) và trang bảng giá của cơ
*  sở thu mua. Sửa ở đây là sửa cả ba nơi, không phải ba bản riêng. */
function Categories() {
	const [rows, setRows] = useState(WASTES);
	const [flash, setFlash] = useState("");
	const set = (id, patch) => setRows((rs) => rs.map((w) => w.id === id ? {
		...w,
		...patch
	} : w));
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "CẤU HÌNH",
				title: "Danh mục rác hệ thống",
				body: "Giá và luật xử lý ở đây là nguồn cho trang tra cứu, hướng dẫn phân loại và bảng giá của cơ sở thu mua. Sửa một chỗ là cả ba nơi cùng đổi."
			}),
			/* @__PURE__ */ jsx(Table, {
				head: [
					"Tên loại rác",
					"Nhóm",
					"Giá tham khảu",
					"Thu gom được",
					"Luật xử lý"
				],
				children: rows.map((w) => /* @__PURE__ */ jsxs("tr", { children: [
					/* @__PURE__ */ jsxs(Td, {
						className: "font-semibold text-ink",
						children: [w.name, /* @__PURE__ */ jsx("span", {
							className: "block text-[12px] font-normal text-muted",
							children: w.id
						})]
					}),
					/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx("select", {
						className: "input h-9 w-32",
						value: w.group,
						onChange: (e) => set(w.id, { group: e.target.value }),
						"aria-label": `Nhóm của ${w.name}`,
						children: WASTE_GROUPS.filter((g) => g !== WASTE_GROUPS[0]).map((g) => /* @__PURE__ */ jsx("option", {
							value: g,
							children: g
						}, g))
					}) }),
					/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsxs("div", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("input", {
							className: "input h-9 w-28 tabular-nums",
							type: "number",
							min: 0,
							step: 100,
							value: w.price,
							disabled: !w.recyclable,
							onChange: (e) => set(w.id, { price: Number(e.target.value) }),
							"aria-label": `Giá của ${w.name}`
						}), /* @__PURE__ */ jsx("span", {
							className: "whitespace-nowrap text-[13px] text-muted",
							children: "đ/kg"
						})]
					}) }),
					/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsxs("label", {
						className: "flex items-center gap-2",
						children: [/* @__PURE__ */ jsx("input", {
							type: "checkbox",
							className: "size-4 accent-brand",
							checked: w.recyclable,
							onChange: (e) => set(w.id, { recyclable: e.target.checked })
						}), /* @__PURE__ */ jsx("span", {
							className: "text-[13px] text-body",
							children: w.recyclable ? "Có" : "Không"
						})]
					}) }),
					/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx("input", {
						className: "input h-9",
						value: w.rule,
						onChange: (e) => set(w.id, { rule: e.target.value }),
						"aria-label": `Luật xử lý của ${w.name}`
					}) })
				] }, w.id))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-4",
				children: [
					/* @__PURE__ */ jsx("button", {
						type: "button",
						onClick: () => setFlash("Đã lưu. Tra cứu và hướng dẫn phân loại dùng luôn giá mới."),
						className: "btn-primary h-11 px-6",
						children: "Lưu thay đổi"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-[13px] text-muted",
						children: [
							"Tổng ",
							fmtInt(rows.filter((w) => w.recyclable).length),
							" loại thu gom được,",
							" ",
							fmtInt(rows.filter((w) => !w.recyclable).length),
							" loại không thu gom. Giá cao nhất ",
							VND(Math.max(...rows.map((w) => w.price))),
							"/kg."
						]
					}),
					flash && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: flash
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-base font-bold text-ink",
				children: "Thêm loại rác mới"
			}), /* @__PURE__ */ jsx(AddForm, { onAdd: (w) => setRows((rs) => [...rs, w]) })] }),
			/* @__PURE__ */ jsx(Status, {
				tone: "wait",
				children: "Giá mới chỉ áp dụng cho các yêu cầu tạo sau này. Yêu cầu đã chốt giữ nguyên giá đã báo."
			})
		]
	});
}
function AddForm({ onAdd }) {
	const [name, setName] = useState("");
	const [price, setPrice] = useState(2e3);
	const [rule, setRule] = useState("");
	return /* @__PURE__ */ jsxs("form", {
		onSubmit: (e) => {
			e.preventDefault();
			if (name.trim().length < 3 || rule.trim().length < 10) return;
			onAdd({
				id: `w-${Date.now().toString(36)}`,
				name: name.trim(),
				group: "Nhựa",
				price,
				recyclable: true,
				rule: rule.trim(),
				prep: "Làm sạch và tách vật liệu khác nếu có."
			});
			setName("");
			setRule("");
		},
		noValidate: true,
		className: "card mt-3 grid gap-4 p-5 md:grid-cols-[1fr_140px] md:p-6",
		children: [
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-4",
				children: [/* @__PURE__ */ jsx(Field, {
					label: "Tên loại rác",
					children: /* @__PURE__ */ jsx("input", {
						className: "input",
						value: name,
						onChange: (e) => setName(e.target.value),
						placeholder: "Ví dụ: Nhựa PVC ống nước"
					})
				}), /* @__PURE__ */ jsx(Field, {
					label: "Luật xử lý",
					hint: "Câu này hiện cho người dân ở trang hướng dẫn phân loại.",
					children: /* @__PURE__ */ jsx("input", {
						className: "input",
						value: rule,
						onChange: (e) => setRule(e.target.value),
						placeholder: "Ống nước PVC, không thu gom chung với nhựa khác."
					})
				})]
			}),
			/* @__PURE__ */ jsx(Field, {
				label: "Giá (đ/kg)",
				children: /* @__PURE__ */ jsx("input", {
					className: "input tabular-nums",
					type: "number",
					min: 0,
					step: 100,
					value: price,
					onChange: (e) => setPrice(Number(e.target.value))
				})
			}),
			/* @__PURE__ */ jsx("div", {
				className: "md:col-span-2",
				children: /* @__PURE__ */ jsx("button", {
					type: "submit",
					className: "btn-primary h-11 px-6",
					children: "Thêm vào danh mục"
				})
			})
		]
	});
}
//#endregion
//#region src/pages/admin/Policy.tsx
/** A-06 Thiết lập chính sách phân loại (Rule Engine).
*
*  Rule ở đây là câu chữ hiện cho người dân ở `/guidance` và ở trang nhận
*  diện AI. Không có bộ luật điều kiện riêng: nếu cần một luật phức tạp (rác
*  nào ở khu vực nào thì giá bao nhiêu) thì viết thành câu rõ ràng ở đây —
*  Rule Engine chỉ lấy câu đó ra hiển thị, không tự suy luận. */
function Policy() {
	const [rules, setRules] = useState(WASTES.filter((w) => w.recyclable).map((w) => ({ ...w })));
	const [flash, setFlash] = useState("");
	const set = (id, patch) => setRules((rs) => rs.map((r) => r.id === id ? {
		...r,
		...patch
	} : r));
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "CẤU HÌNH",
				title: "Chính sách phân loại rác",
				body: "Câu chữ ở đây hiện thẳng cho người dân ở hướng dẫn phân loại và trong kết quả nhận diện AI. Viết sao cho người đọc không phải đoán."
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "grid gap-4 lg:grid-cols-2",
				children: rules.map((r) => /* @__PURE__ */ jsxs("li", {
					className: "card flex flex-col gap-3 p-5",
					children: [
						/* @__PURE__ */ jsx("p", {
							className: "text-base font-bold text-ink",
							children: r.name
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Câu luật hiện cho người dân",
							children: /* @__PURE__ */ jsx("input", {
								className: "input",
								value: r.rule,
								onChange: (e) => set(r.id, { rule: e.target.value })
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Hướng dẫn chuẩn bị",
							children: /* @__PURE__ */ jsx("textarea", {
								className: "input h-auto resize-y py-3 leading-6",
								rows: 2,
								value: r.prep,
								onChange: (e) => set(r.id, { prep: e.target.value })
							})
						})
					]
				}, r.id))
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-4",
				children: [/* @__PURE__ */ jsx("button", {
					type: "button",
					onClick: () => setFlash("Đã lưu. Hướng dẫn phân loại và kết quả AI hiện câu mới ngay."),
					className: "btn-primary h-11 px-6",
					children: "Lưu chính sách"
				}), flash && /* @__PURE__ */ jsx("p", {
					role: "status",
					className: "text-[13px] font-semibold text-brand",
					children: flash
				})]
			}),
			/* @__PURE__ */ jsxs("section", {
				className: "card flex flex-col gap-3 p-5",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "text-base font-bold text-ink",
						children: "Điểm thưởng theo khối lượng"
					}),
					/* @__PURE__ */ jsxs("p", {
						className: "text-sm leading-6 text-body",
						children: [
							"Người dùng nhận",
							" ",
							/* @__PURE__ */ jsx("b", {
								className: "tabular-nums text-ink",
								children: GAMIFICATION.pointsPerKg
							}),
							" điểm xanh cho mỗi kg bàn giao đúng loại đã thẩm định. Đây là con số dùng chung với bảng xếp hạng và đổi thưởng — đổi ở đây thì cả hai nơi đổi theo."
						]
					}),
					/* @__PURE__ */ jsx(Status, {
						tone: "wait",
						children: "Bảng điểm hiện ở trang đổi thưởng là dữ liệu mô phỏng. Nối API thì đọc từ cấu hình này, đừng hardcode ở trang."
					})
				]
			})
		]
	});
}
//#endregion
//#region src/pages/admin/Gamification.tsx
/** A-07 Cấu hình gamification: tỷ lệ điểm và mốc level cây ảo.
*
*  Mốc level nối thẳng với Eco Fact: mỗi hạng có một "chi phí mở khoá" cho
*  nhánh cây. Hai bảng đặt cạnh nhau vì sửa hạng mà quên nhánh cây thì người
*  dùng lên hạng xong không mở được gì. */
function GamificationConfig() {
	const [pointsPerKg, setPointsPerKg] = useState(GAMIFICATION.pointsPerKg);
	const [labelBonus, setLabelBonus] = useState(GAMIFICATION.labelBonus);
	const [tiers, setTiers] = useState([...GAMIFICATION.tiers]);
	const [flash, setFlash] = useState("");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "CẤU HÌNH",
				title: "Cấu hình điểm và hạng cây ảo",
				body: "Điểm người dùng tích luỹ từ giao rác đúng phân loại. Đổi hạng hoặc đổi điểm thưởng ở đây sẽ áp dụng cho tất cả tài khoản."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-6 lg:grid-cols-[1fr_1.4fr]",
				children: [/* @__PURE__ */ jsxs("form", {
					onSubmit: (e) => {
						e.preventDefault();
						setFlash("Đã lưu cấu hình điểm.");
					},
					className: "card flex flex-col gap-5 p-5 md:p-6",
					children: [
						/* @__PURE__ */ jsx(Field, {
							label: "Điểm mỗi kg bàn giao đúng loại",
							hint: "Tính trên khối lượng người dùng xác nhận, không phải khối lượng ước tính.",
							children: /* @__PURE__ */ jsx("input", {
								className: "input tabular-nums",
								type: "number",
								min: 0,
								value: pointsPerKg,
								onChange: (e) => setPointsPerKg(Number(e.target.value))
							})
						}),
						/* @__PURE__ */ jsx(Field, {
							label: "Điểm thưởng khi gán nhãn AI đúng",
							hint: "Dành cho nhân viên vận hành.",
							children: /* @__PURE__ */ jsx("input", {
								className: "input tabular-nums",
								type: "number",
								min: 0,
								value: labelBonus,
								onChange: (e) => setLabelBonus(Number(e.target.value))
							})
						}),
						/* @__PURE__ */ jsx("button", {
							type: "submit",
							className: "btn-primary h-11 px-6",
							children: "Lưu cấu hình"
						}),
						flash && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: flash
						})
					]
				}), /* @__PURE__ */ jsxs("div", {
					className: "flex flex-col gap-4",
					children: [
						/* @__PURE__ */ jsxs("div", {
							className: "grid gap-4 sm:grid-cols-3",
							children: [
								/* @__PURE__ */ jsx(Stat, {
									label: "Hạng hiện có",
									value: String(tiers.length),
									note: "Từ Mầm tới Đại dương"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Eco Fact đã gắn hạng",
									value: String(ECO_FACTS.length),
									note: "Mở khoá bằng điểm tiêu dùng"
								}),
								/* @__PURE__ */ jsx(Stat, {
									label: "Điểm cần cho hạng cao nhất",
									value: tiers[tiers.length - 1].min.toLocaleString("vi-VN"),
									note: "Tích luỹ trọn đời"
								})
							]
						}),
						/* @__PURE__ */ jsx(Table, {
							head: [
								"Hạng",
								"Điểm tối thiểu",
								"Chi phí mở Eco Fact"
							],
							children: tiers.map((t, i) => /* @__PURE__ */ jsxs("tr", { children: [
								/* @__PURE__ */ jsx(Td, {
									className: "font-semibold text-ink",
									children: t.name
								}),
								/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx("input", {
									className: "input h-9 w-32 tabular-nums",
									type: "number",
									min: 0,
									step: 1e3,
									value: t.min,
									disabled: i === 0,
									onChange: (e) => setTiers((ts) => ts.map((x, n) => n === i ? {
										...x,
										min: Number(e.target.value)
									} : x)),
									"aria-label": `Điểm tối thiểu của hạng ${t.name}`
								}) }),
								/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx("input", {
									className: "input h-9 w-32 tabular-nums",
									type: "number",
									min: 0,
									step: 100,
									value: t.factCost,
									onChange: (e) => setTiers((ts) => ts.map((x, n) => n === i ? {
										...x,
										factCost: Number(e.target.value)
									} : x)),
									"aria-label": `Chi phí mở Eco Fact của hạng ${t.name}`
								}) })
							] }, t.name))
						}),
						/* @__PURE__ */ jsx("button", {
							type: "button",
							onClick: () => setTiers((ts) => [...ts, {
								name: `Hạng ${ts.length + 1}`,
								min: ts[ts.length - 1].min + 1e4,
								factCost: 2500
							}]),
							className: "btn-ghost h-11 w-fit px-5",
							children: "Thêm hạng mới"
						})
					]
				})]
			}),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Điểm xếp hạng tích luỹ trọn đời và không bị trừ khi đổi quà; điểm tiêu dùng mới bị trừ. Tách hai loại là để người dùng dám đổi — nếu một con số vừa xếp hạng vừa là tiền thì đổi quà là tụt hạng, họ sẽ không đổi."
			})
		]
	});
}
//#endregion
//#region src/pages/admin/Leaderboard.tsx
/** A-08 Cấu hình chu kỳ bảng xếp hạng (Tuần / Tháng / Quý).
*
*  Bật nhiều chu kỳ cùng lúc thì người dùng phải tự hiểu "quý" tính khác gì
*  "tuần". Cho phép bật tối đa một chu kỳ, và hiện bảng xếp hạng tương ứng với
*  chu kỳ đang bật — bảng nào không bật thì không render, không phải render
*  rồi ghi "tạm thời không xếp hạng". */
function LeaderboardConfig() {
	const [on, setOn] = useState(CYCLES.find((c) => c.active).id);
	const [flash, setFlash] = useState("");
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "CẤU HÌNH",
				title: "Chu kỳ bảng xếp hạng",
				body: "Chỉ một chu kỳ được tính tại một thời điểm. Bật thêm chu kỳ thứ hai thì người dùng phải tự đoán cái nào tính điểm gì."
			}),
			/* @__PURE__ */ jsx("ul", {
				className: "grid gap-4 sm:grid-cols-3",
				children: CYCLES.map((c) => /* @__PURE__ */ jsxs("li", {
					className: `card flex flex-col gap-3 p-5 transition-colors ${on === c.id ? "border-brand bg-brand/6" : ""}`,
					children: [
						/* @__PURE__ */ jsxs("label", {
							className: "flex items-center justify-between gap-3",
							children: [/* @__PURE__ */ jsx("span", {
								className: "text-base font-bold text-ink",
								children: c.label
							}), /* @__PURE__ */ jsx("input", {
								type: "radio",
								name: "cycle",
								className: "size-4 accent-brand",
								checked: on === c.id,
								onChange: () => {
									setOn(c.id);
									setFlash(`Đã chuyển bảng xếp hạng sang chu kỳ ${c.label.toLowerCase()}.`);
								}
							})]
						}),
						/* @__PURE__ */ jsxs("p", {
							className: "text-[13px] text-muted",
							children: [
								"Từ ",
								c.from,
								" đến ",
								c.to
							]
						}),
						/* @__PURE__ */ jsx("div", {
							className: "mt-auto",
							children: /* @__PURE__ */ jsx(Status, {
								tone: on === c.id ? "ok" : "off",
								children: on === c.id ? "Đang tính" : "Tắt"
							})
						})
					]
				}, c.id))
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-baseline justify-between gap-3",
				children: [/* @__PURE__ */ jsxs("h2", {
					className: "text-lg leading-7 font-bold tracking-tight text-ink",
					children: ["Bảng xếp hạng ", CYCLES.find((c) => c.id === on)?.label.toLowerCase()]
				}), /* @__PURE__ */ jsx("p", {
					className: "text-sm text-muted",
					children: "Theo điểm xếp hạng, đổi quà không làm tụt hạng"
				})]
			}), /* @__PURE__ */ jsx("ol", {
				className: "card mt-4 divide-y divide-line-soft overflow-hidden",
				children: LEADERBOARD.map((r, i) => /* @__PURE__ */ jsxs("li", {
					className: `flex items-center gap-3 px-4 py-3 ${r.you ? "bg-brand/8" : ""}`,
					children: [
						/* @__PURE__ */ jsx("span", {
							className: "w-6 shrink-0 text-sm font-semibold tabular-nums text-muted",
							children: i + 1
						}),
						/* @__PURE__ */ jsxs("div", {
							className: "min-w-0 flex-1",
							children: [/* @__PURE__ */ jsxs("p", {
								className: "truncate text-sm font-semibold text-ink",
								children: [r.name, r.you && /* @__PURE__ */ jsx("span", {
									className: "ml-1.5 text-xs text-brand",
									children: "(tài khoản mẫu)"
								})]
							}), /* @__PURE__ */ jsx("p", {
								className: "truncate text-xs text-muted",
								children: r.area
							})]
						}),
						/* @__PURE__ */ jsx("span", {
							className: "shrink-0 text-sm font-bold tabular-nums text-ink",
							children: fmt(r.points)
						})
					]
				}, r.name))
			})] }),
			flash && /* @__PURE__ */ jsx("p", {
				role: "status",
				className: "text-[13px] font-semibold text-brand",
				children: flash
			})
		]
	});
}
//#endregion
//#region src/pages/admin/Fees.tsx
/** A-10 Cấu hình phí giao dịch.
*
*  Con số `FEE_RATE` dùng chung với công thức giải ngân (SYS-01) và biên nhận
*  của cơ sở thu mua. Đổi ở đây thì cả ba nơi cùng đổi — trước khi gộp, mỗi
*  nơi một hằng số và cả ba đã lệch nhau một lần.
*
*  Không có nút "Áp dụng" vì con số này quyết định tiền thật cho hàng nghìn
*  giao dịch đang chạy: ô số bị sửa dở thì đổi luôn là sai tiền. Ở đây chỉ
*  ghi ra giá trị đang áp dụng. */
function Fees() {
	const [rate, setRate] = useState(FEE.rate);
	const [fixed, setFixed] = useState(FEE.fixed);
	const [flash, setFlash] = useState("");
	const dirty = rate !== FEE.rate || fixed !== FEE.fixed;
	const sample = settle(5e5);
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [/* @__PURE__ */ jsx(PageHead, {
			eyebrow: "CẤU HÌNH",
			title: "Cấu hình phí giao dịch",
			body: "Phí nền tảng trích trên mỗi giao dịch thành công. Phần này là nguồn tiền duy nhất của nền tảng, nên đổi ở đây cần Admin thứ hai xác nhận."
		}), /* @__PURE__ */ jsxs("div", {
			className: "grid gap-6 lg:grid-cols-[1fr_1fr]",
			children: [/* @__PURE__ */ jsxs("form", {
				onSubmit: (e) => {
					e.preventDefault();
					setFlash("Đã lưu. Giá trị mới áp dụng cho giao dịch phát sinh sau khi lưu, không đổi giao dịch đã chốt.");
				},
				className: "card flex flex-col gap-5 p-5 md:p-6",
				children: [
					/* @__PURE__ */ jsx(Field, {
						label: "Phí theo tỷ lệ",
						hint: `Đang áp dụng ${(FEE.rate * 100).toFixed(0)}% từ ngày ${FEE.effectiveFrom}.`,
						children: /* @__PURE__ */ jsxs("div", {
							className: "flex items-center gap-3",
							children: [/* @__PURE__ */ jsx("input", {
								className: "input tabular-nums",
								type: "number",
								min: 0,
								max: 50,
								step: .5,
								value: rate * 100,
								onChange: (e) => setRate(Number(e.target.value) / 100)
							}), /* @__PURE__ */ jsx("span", {
								className: "text-sm font-semibold text-body",
								children: "%"
							})]
						})
					}),
					/* @__PURE__ */ jsx(Field, {
						label: "Phí cố định mỗi lượt thu gom",
						hint: "Cộng thêm sau khi trừ tỷ lệ, dùng cho các giao dịch rất nhỏ để hệ thống vẫn có chi phí xử lý.",
						children: /* @__PURE__ */ jsx("input", {
							className: "input tabular-nums",
							type: "number",
							min: 0,
							step: 500,
							value: fixed,
							onChange: (e) => setFixed(Number(e.target.value))
						})
					}),
					/* @__PURE__ */ jsx(Field, {
						label: "Số tiền về tối thiểu",
						hint: "Giao dịch nhỏ hơn ngưỡng này thì không trả tiền, chuyển sang ghi nhận điểm. Tránh trả tiền cho một giao dịch mất người dùng tiền phí chuyển khoản.",
						children: /* @__PURE__ */ jsx("input", {
							className: "input tabular-nums",
							type: "number",
							min: 0,
							step: 1e3,
							defaultValue: FEE.minNet
						})
					}),
					/* @__PURE__ */ jsxs("div", {
						className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
						children: [/* @__PURE__ */ jsx("button", {
							type: "submit",
							disabled: !dirty,
							className: "btn-primary h-11 px-6",
							children: "Lưu phí giao dịch"
						}), flash && /* @__PURE__ */ jsx("p", {
							role: "status",
							className: "text-[13px] font-semibold text-brand",
							children: flash
						})]
					})
				]
			}), /* @__PURE__ */ jsxs("div", {
				className: "flex flex-col gap-4",
				children: [
					/* @__PURE__ */ jsxs("div", {
						className: "grid gap-4 sm:grid-cols-2",
						children: [/* @__PURE__ */ jsx(Stat, {
							label: "Phí thu được 30 ngày",
							value: fmtVnd(14736e4),
							note: "Toàn hệ thống"
						}), /* @__PURE__ */ jsx(Stat, {
							label: "Giao dịch 30 ngày",
							value: fmtInt(3640),
							note: "Bình quân 40.484 đ/giao dịch phí"
						})]
					}),
					/* @__PURE__ */ jsxs("section", {
						className: "card p-5",
						children: [
							/* @__PURE__ */ jsx("h2", {
								className: "text-base font-bold text-ink",
								children: "Ví dụ giao dịch 500.000 đồng"
							}),
							/* @__PURE__ */ jsx("dl", {
								className: "mt-4 flex flex-col gap-2 text-sm",
								children: [
									["Tiền người dân bán rác", sample.gross],
									[`Phí nền tảng ${(rate * 100).toFixed(0)}%`, -sample.fee],
									["Cơ sở thu mua thực nhận", sample.net]
								].map(([k, v]) => /* @__PURE__ */ jsxs("div", {
									className: "flex justify-between gap-3 border-b border-line-soft pb-2",
									children: [/* @__PURE__ */ jsx("dt", {
										className: "text-muted",
										children: k
									}), /* @__PURE__ */ jsx("dd", {
										className: `font-semibold tabular-nums ${Number(v) < 0 ? "text-warn" : "text-ink"}`,
										children: fmtVnd(Number(v))
									})]
								}, k))
							}),
							/* @__PURE__ */ jsx("p", {
								className: "mt-4 text-[13px] leading-5 text-muted",
								children: "Cùng công thức này chạy ở giải ngân tự động và ở biên nhận của cơ sở thu mua, nên số tiền người dân thấy và số tiền người thu gom thấy luôn khớp."
							})
						]
					}),
					/* @__PURE__ */ jsx("p", {
						className: "text-[13px] leading-5 text-muted",
						children: "Đổi tỷ lệ phí không được làm cho một giao dịch nhỏ thành số tiền âm. Công thức hiện tại đã kẹp bằng ngưỡng tiền về tối thiểu ở trên."
					})
				]
			})]
		})]
	});
}
//#endregion
//#region src/pages/admin/Reconciliation.tsx
/** A-11 Đối soát dòng tiền.
*
*  Bảng đối soát gom theo mã bàn giao thay vì liệt kê từng dòng tiền: mỗi giao
*  dịch có 3 dòng (pay-in, phí, pay-out) và việc cần chứng minh là 3 dòng đó
*  khớp nhau. Bảng theo dòng sẽ phải tự dò ba dòng cạnh nhau bằng mắt.
*
*  Trạng thái tính từ dữ liệu chứ không lưu: đã đủ 3 dòng và tổng khớp là
*  "Đã đối soát", lệch là "Chênh lệch". Lưu kết luận riêng là có thêm chỗ
*  để trạng thái và dữ liệu lệch nhau. */
function Reconciliation() {
	const groups = [...new Set(FLOWS.map((f) => f.handoverId))].map((id) => {
		const rows = FLOWS.filter((f) => f.handoverId === id);
		const payin = rows.find((r) => r.kind === "payin")?.amount ?? 0;
		const fee = rows.find((r) => r.kind === "fee")?.amount ?? 0;
		const payout = rows.find((r) => r.kind === "payout")?.amount ?? 0;
		const expectedFee = Math.round(payin * FEE.rate);
		return {
			id,
			rows,
			payin,
			fee,
			payout,
			expectedFee,
			ok: payin - fee === payout && fee === expectedFee
		};
	}).sort((a, b) => a.id < b.id ? 1 : -1);
	const totalFee = groups.reduce((s, g) => s + g.fee, 0);
	const matched = groups.filter((g) => g.ok).length;
	return /* @__PURE__ */ jsxs("div", {
		className: "flex flex-col gap-6",
		children: [
			/* @__PURE__ */ jsx(PageHead, {
				eyebrow: "TÀI CHÍNH",
				title: "Đối soát và dòng tiền",
				body: "Mỗi giao dịch có ba dòng: tiền đối tác chuyển vào, phí nền tảng giữ lại, và tiền bắn về người dân. Giao dịch khớp cả ba là đã đối soát."
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "grid gap-4 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ jsx(Stat, {
						label: "Giao dịch trong kỳ",
						value: String(groups.length)
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Đã đối soát",
						value: String(matched),
						note: "Ba dòng khớp nhau"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Còn chênh lệch",
						value: String(groups.length - matched),
						note: "Cần tra webhook VietQR"
					}),
					/* @__PURE__ */ jsx(Stat, {
						label: "Phí thu được",
						value: fmtVnd(totalFee),
						note: `Tỷ lệ đang áp dụng ${(FEE.rate * 100).toFixed(0)}%`
					})
				]
			}),
			/* @__PURE__ */ jsxs("section", { children: [/* @__PURE__ */ jsx("h2", {
				className: "text-lg leading-7 font-bold tracking-tight text-ink",
				children: "Đối soát theo giao dịch"
			}), /* @__PURE__ */ jsx("div", {
				className: "mt-4",
				children: /* @__PURE__ */ jsx(Table, {
					head: [
						"Mã bàn giao",
						"Tiền vào từ đối tác",
						"Phí phải thu",
						"Phí thực thu",
						"Tiền về người dân",
						"Kết quả"
					],
					children: groups.map((g) => /* @__PURE__ */ jsxs("tr", { children: [
						/* @__PURE__ */ jsx(Td, {
							className: "tabular-nums font-semibold whitespace-nowrap text-ink",
							children: g.id
						}),
						/* @__PURE__ */ jsx(Td, {
							className: "tabular-nums whitespace-nowrap",
							children: fmtVnd(g.payin)
						}),
						/* @__PURE__ */ jsx(Td, {
							className: "tabular-nums whitespace-nowrap text-muted",
							children: fmtVnd(g.expectedFee)
						}),
						/* @__PURE__ */ jsx(Td, {
							className: "tabular-nums whitespace-nowrap",
							children: fmtVnd(g.fee)
						}),
						/* @__PURE__ */ jsx(Td, {
							className: "tabular-nums whitespace-nowrap",
							children: fmtVnd(g.payout)
						}),
						/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(Status, {
							tone: g.ok ? "ok" : "off",
							children: g.ok ? "Đã đối soát" : "Chênh lệch"
						}) })
					] }, g.id))
				})
			})] }),
			/* @__PURE__ */ jsxs("section", { children: [
				/* @__PURE__ */ jsx("h2", {
					className: "text-lg leading-7 font-bold tracking-tight text-ink",
					children: "Dòng tiền chi tiết"
				}),
				/* @__PURE__ */ jsx("p", {
					className: "mt-1 text-sm text-muted",
					children: "Ba dòng của mỗi giao dịch nằm cạnh nhau để đối chiếu bằng mắt khi tra webhook."
				}),
				/* @__PURE__ */ jsx("div", {
					className: "mt-4",
					children: /* @__PURE__ */ jsx(Table, {
						head: [
							"Ngày",
							"Mã bàn giao",
							"Loại",
							"Số tiền",
							"Đối tác / đích nhận"
						],
						children: FLOWS.map((f) => /* @__PURE__ */ jsxs("tr", { children: [
							/* @__PURE__ */ jsx(Td, {
								className: "tabular-nums whitespace-nowrap",
								children: f.date
							}),
							/* @__PURE__ */ jsx(Td, {
								className: "tabular-nums whitespace-nowrap",
								children: f.handoverId
							}),
							/* @__PURE__ */ jsx(Td, { children: /* @__PURE__ */ jsx(Status, {
								tone: f.kind === "payout" ? "ok" : f.kind === "fee" ? "off" : "wait",
								children: KIND_LABEL[f.kind]
							}) }),
							/* @__PURE__ */ jsxs(Td, {
								className: "font-semibold tabular-nums whitespace-nowrap text-ink",
								children: [fmtInt(f.amount), " đ"]
							}),
							/* @__PURE__ */ jsx(Td, { children: f.party })
						] }, f.id))
					})
				})
			] }),
			/* @__PURE__ */ jsx("p", {
				className: "max-w-[70ch] text-sm leading-6 text-muted",
				children: "Giao dịch chênh lệch thường do webhook VietQR đến muộn hơn lúc người dùng xác nhận biên nhận: tiền chưa về nên hệ thống chưa giải ngân. Hệ thống tự bắn lại khi webhook tới, quá 24 giờ thì cần tra thủ công."
			})
		]
	});
}
//#endregion
//#region src/pages/admin/AccountProfile.tsx
/** Hồ sơ và thông báo cho STAFF và ADMIN.
*
*  TÁCH khỏi `/account/profile` của người dân, dù đều gọi là "hồ sơ": hai bên
*  không có gì giống nhau. Người dân có điểm cây ảo, xếp hạng, lịch thu gom —
*  nhân viên không có. Nhân viên có mã nhân viên, bộ phận, quyền được cấp —
*  người dân không có. Để chung một trang thì phải nhồi hai bảng chồng lên nhau
*  và 3/4 nội dung là thừa với một trong hai bên.
*
*  Thông báo cũng khác: của người dân là "cô Ba đã nhận yêu cầu của bạn", của
*  nhân viên là việc đang chờ trong hàng đợi vận hành. Số đếm thẳng từ bảng
*  dữ liệu nên không bao giờ lệch với trang đếm chi tiết bên cạnh. */
function AccountProfile() {
	const session = useSession();
	const role = session?.role === "admin" ? "admin" : "staff";
	const me = STAFF.find((s) => s.name === session?.name);
	const [name, setName] = useState(session?.name ?? "");
	const [phone, setPhone] = useState("0901 234 567");
	const [saved, setSaved] = useState(false);
	const [err, setErr] = useState("");
	const submit = (e) => {
		e.preventDefault();
		if (name.trim().length < 2) {
			setErr("Tên hiển thị phải có ít nhất 2 ký tự.");
			setSaved(false);
			return;
		}
		if (!/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, ""))) {
			setErr("Số điện thoại chưa đúng định dạng Việt Nam.");
			setSaved(false);
			return;
		}
		setErr("");
		setSaved(true);
	};
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(PageHead, {
		eyebrow: "TÀI KHOẢN NỘI BỘ",
		title: role === "admin" ? "Hồ sơ quản trị" : "Hồ sơ nhân viên",
		body: `Tài khoản ${ROLE_LABEL[role].toLowerCase()} đang đăng nhập và những việc đang chờ trong console. Mã nhân viên và quyền do quản trị viên cấp, không sửa được ở đây.`
	}), /* @__PURE__ */ jsxs("div", {
		className: "grid gap-6 lg:grid-cols-[1.2fr_1fr]",
		children: [/* @__PURE__ */ jsxs("form", {
			onSubmit: submit,
			noValidate: true,
			className: "card flex flex-col gap-5 self-start p-5 md:p-6",
			children: [
				/* @__PURE__ */ jsx(Field, {
					label: "Tên hiển thị",
					hint: "Tên này hiện cạnh quyền trong log vận hành.",
					children: /* @__PURE__ */ jsx("input", {
						className: `input ${err && name.trim().length < 2 ? "border-warn" : ""}`,
						value: name,
						onChange: (e) => {
							setName(e.target.value);
							setSaved(false);
						}
					})
				}),
				/* @__PURE__ */ jsx(Field, {
					label: "Số điện thoại nội bộ",
					hint: "Để người trực ban gọi khi có việc gấp ngoài giờ.",
					children: /* @__PURE__ */ jsx("input", {
						className: `input tabular-nums ${err && !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s.\-()]/g, "")) ? "border-warn" : ""}`,
						inputMode: "tel",
						value: phone,
						onChange: (e) => {
							setPhone(e.target.value);
							setSaved(false);
						}
					})
				}),
				/* @__PURE__ */ jsxs(Field, {
					label: "Email công việc",
					children: [/* @__PURE__ */ jsx("input", {
						className: "input",
						value: me?.email ?? "quantri@ecolink.vn",
						readOnly: true,
						disabled: true
					}), /* @__PURE__ */ jsx("span", {
						className: "text-[12px] text-muted",
						children: "Email là định danh đăng nhập, đổi ở phòng IT chứ không sửa trên web."
					})]
				}),
				err && /* @__PURE__ */ jsx("p", {
					className: "text-[13px] text-warn",
					children: err
				}),
				/* @__PURE__ */ jsxs("div", {
					className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
					children: [/* @__PURE__ */ jsx("button", {
						type: "submit",
						className: "btn-primary h-11 px-6",
						children: "Lưu hồ sơ"
					}), saved && /* @__PURE__ */ jsx("p", {
						role: "status",
						className: "text-[13px] font-semibold text-brand",
						children: "Đã lưu hồ sơ."
					})]
				})
			]
		}), /* @__PURE__ */ jsxs("div", {
			className: "flex flex-col gap-6",
			children: [/* @__PURE__ */ jsxs("section", {
				className: "card p-5",
				children: [
					/* @__PURE__ */ jsx("h2", {
						className: "text-[15px] font-bold text-ink",
						children: "Thông tin được cấp"
					}),
					/* @__PURE__ */ jsx("dl", {
						className: "mt-3 flex flex-col gap-2 text-[13px]",
						children: [
							["Mã nhân viên", me?.id ?? "QT-01"],
							["Vai trò", ROLE_LABEL[role]],
							["Bộ phận", me ? "Vận hành nền tảng" : "Ban quản trị"],
							["Ngày bắt đầu", "12/03/2025"],
							["Trạng thái", me?.status === "locked" ? "Đang khoá" : "Đang hoạt động"]
						].map(([k, v]) => /* @__PURE__ */ jsxs("div", {
							className: "flex justify-between gap-3 border-b border-line-soft pb-2",
							children: [/* @__PURE__ */ jsx("dt", {
								className: "text-muted",
								children: k
							}), /* @__PURE__ */ jsx("dd", {
								className: "font-semibold text-ink",
								children: v
							})]
						}, k))
					}),
					/* @__PURE__ */ jsx("h3", {
						className: "mt-5 text-[11px] font-bold tracking-[0.1em] text-muted uppercase",
						children: "Quyền được cấp"
					}),
					/* @__PURE__ */ jsx("div", {
						className: "mt-2 flex flex-wrap gap-1.5",
						children: role === "admin" ? /* @__PURE__ */ jsx(Status, {
							tone: "ok",
							children: "Toàn quyền hệ thống"
						}) : (me?.perms ?? []).map((id) => /* @__PURE__ */ jsx(Status, {
							tone: "wait",
							children: PERMS.find((p) => p.id === id)?.label ?? id
						}, id))
					}),
					/* @__PURE__ */ jsx("p", {
						className: "mt-3 text-[12px] leading-5 text-muted",
						children: "Quyền do quản trị viên cấp. Cần thêm quyền thì gửi yêu cầu, không tự chỉnh ở đây."
					})
				]
			}), /* @__PURE__ */ jsx(Queue, { role })]
		})]
	})] });
}
/** Việc đang chờ, đếm thẳng từ bảng dữ liệu vận hành.
*
*  Liệt kê RIÊNG theo vai trò, không dùng `/${role}/...` chung: staff và admin
*  không có cùng bộ màn hình. Admin không có `/admin/applications` và
*  `/admin/complaints` — dựng link bằng cách ghép chuỗi sẽ dẫn tới trang 404. */
function Queue({ role }) {
	const rows = role === "staff" ? [
		{
			to: "/staff/ai-review",
			label: "Ảnh AI chờ gán nhãn",
			count: AI_CASES.filter((c) => !c.inDataset).length
		},
		{
			to: "/staff/applications",
			label: "Hồ sơ đối tác chờ thẩm định",
			count: APPLICATIONS.filter((a) => a.status === "pending").length
		},
		{
			to: "/staff/complaints",
			label: "Khiếu nại mới",
			count: COMPLAINTS.filter((c) => c.status === "new").length
		},
		{
			to: "/staff/blog",
			label: "Bài Blog chờ duyệt",
			count: POSTS.filter((p) => p.status === "pending").length
		}
	] : [{
		to: "/admin/blog",
		label: "Bài Blog chờ duyệt",
		count: POSTS.filter((p) => p.status === "pending").length
	}, {
		to: "/admin/staff",
		label: "Nhân viên đang bị khoá",
		count: STAFF.filter((s) => s.status === "locked").length
	}];
	const open = rows.reduce((n, r) => n + r.count, 0);
	return /* @__PURE__ */ jsxs("section", {
		className: "card p-5",
		children: [/* @__PURE__ */ jsxs("div", {
			className: "flex flex-wrap items-baseline justify-between gap-2",
			children: [/* @__PURE__ */ jsx("h2", {
				className: "text-[15px] font-bold text-ink",
				children: "Việc đang chờ"
			}), /* @__PURE__ */ jsx("span", {
				className: "text-[13px] text-muted",
				children: open === 0 ? "Không có việc nào" : `${open} việc`
			})]
		}), /* @__PURE__ */ jsx("ul", {
			className: "mt-3 flex flex-col",
			children: rows.map((r) => /* @__PURE__ */ jsx("li", {
				className: "border-b border-line-soft last:border-0",
				children: /* @__PURE__ */ jsxs(Link, {
					to: r.to,
					className: "flex items-center justify-between gap-3 py-2.5 text-[13px] text-body transition-colors hover:text-brand-deep",
					children: [r.label, r.count === 0 ? /* @__PURE__ */ jsx(Status, {
						tone: "off",
						children: "Xong"
					}) : /* @__PURE__ */ jsxs(Status, {
						tone: "todo",
						children: [r.count, " chờ"]
					})]
				})
			}, r.to))
		})]
	});
}
//#endregion
//#region src/pages/admin/AccountPassword.tsx
/** Đổi mật khẩu cho STAFF và ADMIN.
*
*  Tách khỏi `/account/password` của người dân vì chính sách khác: tài khoản
*  nội bộ đổi mật khẩu là hành động bảo mật, không phải thao tác tiện lợi —
*  nên bắt mật khẩu mới dài hơn và phải có số. Người dân đổi vì quên, nhân
*  viên đổi vì nghi ngờ lộ; hai việc đó không nên dùng chung một ngưỡng.
*
*  Bắt buộc mật khẩu hiện tại đúng mới cho đổi: đây là ranh giới tin cậy —
*  không có nó thì ai đó ngồi máy đã mở khoá cũng đổi được mật khẩu của bạn. */
function AccountPassword() {
	const role = useSession()?.role === "admin" ? "admin" : "staff";
	const [current, setCurrent] = useState("");
	const [next, setNext] = useState("");
	const [again, setAgain] = useState("");
	const [flash, setFlash] = useState("");
	const [err, setErr] = useState("");
	const submit = (e) => {
		e.preventDefault();
		if (current.length < 1) {
			setErr("Nhập mật khẩu hiện tại.");
			return;
		}
		if (next.length < 12) {
			setErr("Mật khẩu mới cần ít nhất 12 ký tự.");
			return;
		}
		if (!/\d/.test(next)) {
			setErr("Mật khẩu mới phải có ít nhất một chữ số.");
			return;
		}
		if (next !== again) {
			setErr("Hai mật khẩu mới không khớp nhau.");
			return;
		}
		if (next === current) {
			setErr("Mật khẩu mới phải khác mật khẩu hiện tại.");
			return;
		}
		setErr("");
		setFlash("Đã đổi mật khẩu. Các phiên khác đã đăng xuất.");
		setCurrent("");
		setNext("");
		setAgain("");
	};
	return /* @__PURE__ */ jsxs(Fragment, { children: [/* @__PURE__ */ jsx(PageHead, {
		eyebrow: "BẢO MẬT",
		title: "Đổi mật khẩu",
		body: `Mật khẩu tài khoản ${ROLE_LABEL[role].toLowerCase()} dài hơn yêu cầu của tài khoản người dân: tối thiểu 12 ký tự và phải có chữ số. Đổi xong mọi thiết bị khác đang đăng nhập sẽ mất phiên ngay.`
	}), /* @__PURE__ */ jsxs("form", {
		onSubmit: submit,
		noValidate: true,
		className: "card flex max-w-[520px] flex-col gap-5 p-5 md:p-6",
		children: [
			/* @__PURE__ */ jsx(Field, {
				label: "Mật khẩu hiện tại",
				children: /* @__PURE__ */ jsx("input", {
					className: `input ${err.startsWith("Nhập") ? "border-warn" : ""}`,
					type: "password",
					value: current,
					onChange: (e) => {
						setCurrent(e.target.value);
						setFlash("");
					},
					autoComplete: "current-password"
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: "Mật khẩu mới",
				hint: "Tối thiểu 12 ký tự, phải có chữ số.",
				children: /* @__PURE__ */ jsx("input", {
					className: `input ${err.startsWith("Mật khẩu mới cần") || err.startsWith("Mật khẩu mới phải có") ? "border-warn" : ""}`,
					type: "password",
					value: next,
					onChange: (e) => {
						setNext(e.target.value);
						setFlash("");
					},
					autoComplete: "new-password"
				})
			}),
			/* @__PURE__ */ jsx(Field, {
				label: "Nhập lại mật khẩu mới",
				children: /* @__PURE__ */ jsx("input", {
					className: `input ${err.startsWith("Hai mật khẩu") ? "border-warn" : ""}`,
					type: "password",
					value: again,
					onChange: (e) => {
						setAgain(e.target.value);
						setFlash("");
					},
					autoComplete: "new-password"
				})
			}),
			err && /* @__PURE__ */ jsx("p", {
				className: "text-[13px] text-warn",
				children: err
			}),
			/* @__PURE__ */ jsxs("div", {
				className: "flex flex-wrap items-center gap-4 border-t border-line-soft pt-4",
				children: [/* @__PURE__ */ jsx("button", {
					type: "submit",
					className: "btn-primary h-11 px-6",
					children: "Đổi mật khẩu"
				}), flash && /* @__PURE__ */ jsx("p", {
					role: "status",
					className: "text-[13px] font-semibold text-brand",
					children: flash
				})]
			})
		]
	})] });
}
//#endregion
//#region src/App.tsx
/** Mọi route sau đăng nhập đều khai báo vai trò được vào. Không có route nào
*  "ai cũng vào được": mọi chức năng đều thuộc đúng một vai trò trong tài
*  liệu use case.
*
*  Tách `AppRoutes` ra khỏi `App` để test được: `check.tsx` render cây route
*  thật với `MemoryRouter`, nếu không thì mọi route đều chỉ được test bằng
*  cách render lẻ từng component — hỏng phần ghép route (RequireRole, Portal,
*  Layout) thì test vẫn xanh. */
function AppRoutes() {
	return /* @__PURE__ */ jsxs(Routes, { children: [
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
					index: true,
					element: /* @__PURE__ */ jsx(Home, {})
				}),
				/* @__PURE__ */ jsx(Route, {
					path: "blog",
					element: /* @__PURE__ */ jsx(Blog, {})
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
					path: "chat",
					element: /* @__PURE__ */ jsx(RequireRole, {
						roles: ["user", "recycler"],
						children: /* @__PURE__ */ jsx(Chat, {})
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
								element: /* @__PURE__ */ jsx(Receipt$1, {})
							}),
							/* @__PURE__ */ jsx(Route, {
								path: "payout",
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
								element: /* @__PURE__ */ jsx(Receipt, {})
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
	] });
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
		["/staff/accounts", "Danh sách User và Buyer"],
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
for (const [role, cases] of Object.entries(BY_ROLE)) {
	signIn("Tài khoản thử", role);
	for (const [path, mustInclude] of cases) try {
		const html = renderToStaticMarkup(/* @__PURE__ */ jsx(MemoryRouter, {
			initialEntries: [path],
			children: /* @__PURE__ */ jsx(AppRoutes, {})
		}));
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
