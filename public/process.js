$(document).ready(function(){
    $('#frmDangKy').on('submit', function(e){
        e.preventDefault();

        const payload = {
            Email: $('#txtEmail').val(),
            HoTen: $('#txtHoTen').val(),
            SoDT: $('#txtSoDT').val()
        };

        $.post('/buy', payload, function(data){
            console.log('Response from /buy:', data);
            if (data && data.ketqua === 1) {
                alert('Đăng ký thành công!');
                // Optionally clear the form
                $('#frmDangKy')[0].reset();
            } else {
                alert(data && data.maloi ? data.maloi : 'Lỗi khi gửi dữ liệu');
            }
        }).fail(function(xhr, status, err){
            console.error('POST /buy failed:', status, err);
            alert('Không thể kết nối tới server');
        });
    });
});