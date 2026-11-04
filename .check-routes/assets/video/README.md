# Video trang chủ

Bỏ video vào thư mục này, **đúng tên**:

```
intro.mp4
poster.jpg
```

Đường dẫn code đang trỏ tới: `/assets/video/intro.mp4` và `/assets/video/poster.jpg`

## Yêu cầu

| | |
|---|---|
| `intro.mp4` | H.264 + AAC. Nên dưới **3MB** để trang không nặng |
| `poster.jpg` | ảnh tĩnh hiện trước khi video nạp. Rộng **1600px**. Bắt buộc, nếu không sẽ có lúc trống |
| Tỉ lệ | 16:9, khuyến nghị `1920x1080` |

Video được phát tự động, không tiếng (`muted`), lặp (`loop`), và `playsInline` để
không bị iOS mở toàn màn hình. Vì `muted` nên trình duyệt mới cho autoplay trên
iPhone — nếu không phát, vẫn hiện `poster.jpg`.

## Nếu dùng định dạng khác

Đổi đường dẫn trong `src/pages/Home.tsx`:

```jsx
<source src="/assets/video/intro.mp4" type="video/mp4" />
```

WebM để giảm dung lượng thì thêm một thẻ `<source>` nữa.
