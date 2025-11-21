const Order = require("../model/Order");

$(document).ready(function () {
    $('#frmDangKy').on('submit', function (e) {
        e.preventDefault();

        const payload = {
            Email: $('#txtEmail').val(),
            HoTen: $('#txtHoTen').val(),
            SoDT: $('#txtSoDT').val(),
            // Nếu có eventId ẩn trong form thì lấy ra
            eventId: $('#eventId').val()
        };

        $.post('/dangky', payload, function (data) {
            console.log('Response:', data);
            if (data && data.ketqua === 1) {
                alert(data.thongbao);
                // Chuyển hướng sang trang thanh toán sau khi đăng ký xong
                // window.location.href = "/order?eventId=..." 
            } else {
                alert(data.maloi || 'Lỗi khi gửi dữ liệu');
            }
        }).fail(function (xhr, status, err) {
            console.error('Lỗi:', err);
            alert('Không thể kết nối tới server');
        });
    });
});