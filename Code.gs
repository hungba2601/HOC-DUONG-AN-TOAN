function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet1 = ss.getSheetByName("Trang tính 1") || ss.getSheetByName("Trang tính1") || ss.getSheetByName("Sheet1");
    if (!sheet1) {
      sheet1 = ss.insertSheet("Trang tính 1");
      sheet1.appendRow(["Tên", "Lớp", "Tài khoản", "Mật khẩu", "Đối tượng", "Thời gian", "SĐT"]);
    }
    
    let sheet2 = ss.getSheetByName("Trang tính 2") || ss.getSheetByName("Trang tính2") || ss.getSheetByName("Sheet2");
    if (!sheet2) {
      sheet2 = ss.insertSheet("Trang tính 2");
      sheet2.appendRow(["Tên TK HS", "Loại thao tác", "Nội dung", "Chi tiết", "Dữ liệu", "Thời gian", "Trạng thái"]);
    }

    let sheet3 = ss.getSheetByName("Trang tính 3") || ss.getSheetByName("Trang tính3") || ss.getSheetByName("Sheet3");
    if (!sheet3) {
      sheet3 = ss.insertSheet("Trang tính 3");
      sheet3.appendRow(["Tiêu đề", "Nội dung/Link", "Loại", "Thời gian"]);
    }

    // JSON response helper
    const jsonRes = (obj) => ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);

    if (action === "register") {
      let { username, password, role, unit } = data;
      username = String(username).toLowerCase().trim();
      unit = String(unit).toUpperCase().trim();
      
      const data1 = sheet1.getDataRange().getValues();
      for (let i = 1; i < data1.length; i++) {
        if (String(data1[i][2]).toLowerCase() === username.toLowerCase()) {
          return jsonRes({ success: false, message: "Tài khoản đã tồn tại!" });
        }
      }
      // Index 0:Tên, 1:Lớp, 2:TK, 3:MK, 4:Role, 5:Time, 6:SĐT
      sheet1.appendRow(["", "", username, password, role, new Date().toISOString(), ""]);
      return jsonRes({ success: true, message: "Đăng ký thành công!" });
    }
    
    if (action === "login") {
      const { username, password, role, unit } = data;
      const data1 = sheet1.getDataRange().getValues();
      
      // Chuẩn hóa dữ liệu nhập vào (trừ mật khẩu)
      const loginUser = String(username || "").toLowerCase().trim();
      const loginPass = String(password || "").trim(); // Giữ nguyên hoa/thường cho pass
      const loginUnit = String(unit || "").toLowerCase().trim();
      const loginRole = String(role || "").toLowerCase().trim();

      for (let i = 1; i < data1.length; i++) {
        const sheetUser = String(data1[i][2] || "").toLowerCase().trim();
        const sheetPass = String(data1[i][3] || "").trim(); // Lấy mật khẩu gốc từ sheet
        const sheetRole = String(data1[i][4] || "").toLowerCase().trim();
        
        if (sheetUser === loginUser && 
            sheetPass === loginPass && 
            sheetRole === loginRole) {
          return jsonRes({ success: true, message: "Đăng nhập thành công!" });
        }
      }
      return jsonRes({ success: false, message: "Sai Tài khoản hoặc Mật khẩu. Vui lòng kiểm tra lại!" });
    }

    if (action === "submitReport") {
      const { username, type, content, details, fileBase64, fileMimeType, fileName, fileUrl, unit } = data;
      let finalFileUrl = fileUrl || "";
      
      if (fileBase64) {
        try {
          const targetFolderStr = "BaoCaoAnToanHocDuong";
          let folders = DriveApp.getFoldersByName(targetFolderStr);
          let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderStr);
          const blob = Utilities.newBlob(Utilities.base64Decode(fileBase64), fileMimeType, fileName);
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          finalFileUrl = file.getUrl();
        } catch (err) {
          // Fallback if drive fails
        }
      }
      
      sheet2.appendRow([username, type, content, details, finalFileUrl, new Date().toISOString(), "Chưa xem", unit || ""]);
      return jsonRes({ success: true, message: "Gửi báo cáo thành công!" });
    }

    if (action === "getData") {
      const { username } = data;
      const data2 = sheet2.getDataRange().getValues();
      const result = [];
      const stats = { community: 0, sent: 0, processed: 0 };
      
      for (let i = 1; i < data2.length; i++) {
        const row = data2[i];
        const rowUser = String(row[0]);
        const rowType = String(row[1]);
        const rowStatus = String(row[6]);

        // Thống kê cộng đồng (chỉ tính Báo cáo ẩn danh)
        if (rowType === "Báo cáo ẩn danh") {
          stats.community++;
        }

        // Dữ liệu riêng của từng học sinh (hiện tất cả các loại: Báo cáo, SOS, Chat)
        if (rowUser === String(username)) {
          stats.sent++;
          // Đếm số lượng đã xử lý của riêng học sinh này để hiện lên dashboard
          if (rowStatus === "Đã xử lý" || rowStatus === "Đã xem") {
            stats.processed++;
          }
          result.push({
            id: i + 1,
            username: row[0],
            type: row[1],
            content: row[2],
            details: row[3],
            fileUrl: row[4],
            time: row[5],
            status: row[6] || "Chưa xem"
          });
        }
      }
      return jsonRes({ success: true, reports: result.reverse(), stats });
    }

    if (action === "getAllReports") {
      const { unit } = data;
      const targetUnit = String(unit || "").toLowerCase().trim();
      const data2 = sheet2.getDataRange().getValues();
      const reports = [];
      const stats = { total: { received: 0, processed: 0 }, anonymous: { received: 0, processed: 0 }, sos: { received: 0, processed: 0 }, chat: { received: 0, processed: 0 } };

      for (let i = 1; i < data2.length; i++) {
        const row = data2[i];

        const id = i + 1;
        const type = row[1];
        const status = row[6] || "Chưa xem";

        reports.push({
          id: id,
          username: row[0],
          type: type,
          content: row[2],
          details: row[3],
          fileUrl: row[4],
          time: row[5],
          status: status
        });

        // Thống kê
        stats.total.received++;
        if (status === "Đã xử lý" || status === "Đã xem") stats.total.processed++;
        if (type === "Báo cáo ẩn danh") {
          stats.anonymous.received++;
          if (status === "Đã xử lý" || status === "Đã xem") stats.anonymous.processed++;
        } else if (type === "SOS Khẩn cấp") {
          stats.sos.received++;
          if (status === "Đã xử lý" || status === "Đã xem") stats.sos.processed++;
        } else if (type === "Hỏi đáp & Tâm sự") {
          stats.chat.received++;
          if (status === "Đã xử lý" || status === "Đã xem") stats.chat.processed++;
        }
      }
      return jsonRes({ success: true, reports: reports.reverse(), stats });
    }

    if (action === "markAsRead") {
      const { id } = data;
      if (id) {
        sheet2.getRange(Number(id), 7).setValue("Đã xử lý");
        return jsonRes({ success: true, message: "Đã đánh dấu xử lý!" });
      }
      return jsonRes({ success: false, message: "Thiếu ID nội dung." });
    }

    if (action === "replyChat") {
      const { id, replyText } = data;
      if (id) {
        // Cột D là cột "Chi tiết", index=4, Cột G là "Trạng thái", index=7
        sheet2.getRange(Number(id), 4).setValue(replyText);
        sheet2.getRange(Number(id), 7).setValue("Đã xử lý");
        return jsonRes({ success: true, message: "Đã phản hồi thành công!" });
      }
      return jsonRes({ success: false, message: "Thiếu ID nội dung." });
    }

    if (action === "deleteReport") {
      const { id } = data;
      if (id) {
        sheet2.deleteRow(Number(id));
        return jsonRes({ success: true, message: "Đã xóa nội dung thành công!" });
      }
      return jsonRes({ success: false, message: "Thiếu ID để xóa." });
    }

    if (action === "deleteCategoryReports") {
      const { type, username } = data;
      const values = sheet2.getDataRange().getValues();
      // Duyệt ngược từ dưới lên để tránh lỗi nhảy index khi xóa hàng
      for (let i = values.length - 1; i >= 1; i--) {
        const rowUser = String(values[i][0]);
        const rowType = String(values[i][1]);
        
        let shouldDelete = false;
        if (username) {
          // Xóa cho học sinh (chỉ xóa nội dung của chính họ trong mục đó)
          if (rowUser === String(username) && rowType === type) shouldDelete = true;
        } else {
          // Xóa cho Admin (xóa tất cả nội dung trong mục đó)
          if (rowType === type) shouldDelete = true;
        }

        if (shouldDelete) {
          sheet2.deleteRow(i + 1);
        }
      }
      return jsonRes({ success: true, message: "Đã dọn dẹp mục này thành công!" });
    }

    if (action === "getAdmins") {
      const data1 = sheet1.getDataRange().getValues();
      const admins = [];
      for (let i = 1; i < data1.length; i++) {
        const role = String(data1[i][4]).toLowerCase();
        if (role === "admin" || role === "teacher") {
          // Tên ở cột A (0), TK ở cột C (2)
          const displayName = data1[i][0] || data1[i][2];
          admins.push({
            name: displayName + " (" + (role === "admin" ? "Quản trị" : "Giáo viên") + ")",
            phone: data1[i][6] || "Chưa có SĐT"
          });
        }
      }
      return jsonRes({ success: true, admins });
    }

    if (action === "getUsers") {
      const data1 = sheet1.getDataRange().getValues();
      const users = [];
      for (let i = 1; i < data1.length; i++) {
        const role = String(data1[i][4]);
        if (role === "student" || role === "teacher") {
          users.push({
            name: data1[i][0] || "---",
            className: data1[i][1] || "---",
            username: data1[i][2],
            role: role,
            time: data1[i][5]
          });
        }
      }
      return jsonRes({ success: true, users: users.reverse() });
    }

    if (action === "deleteUser") {
      const { username } = data;
      const data1 = sheet1.getDataRange().getValues();
      for (let i = 1; i < data1.length; i++) {
        if (String(data1[i][2]) === String(username)) {
          sheet1.deleteRow(i + 1);
          return jsonRes({ success: true, message: "Đã xóa tài khoản học sinh!" });
        }
      }
      return jsonRes({ success: false, message: "Mục không tồn tại hoặc lỗi phân quyền." });
    }

    if (action === "bulkRegister") {
      const { users } = data;
      const data1 = sheet1.getDataRange().getValues();
      const existingUsers = new Set(data1.map(row => String(row[2]).toLowerCase().trim()));
      
      let count = 0;
      users.forEach(u => {
        const username = String(u.username || "").toLowerCase().trim();
        if (username && !existingUsers.has(username)) {
          // A:Tên, B:Lớp, C:TK, D:MK, E:Đối tượng, F:Thời gian, G:SĐT
          sheet1.appendRow([
            u.name || "", 
            u.className || "", 
            username, 
            u.password || "1234", 
            u.role || "student", 
            new Date().toISOString(), 
            u.phone || ""
          ]);
          existingUsers.add(username);
          count++;
        }
      });
      return jsonRes({ success: true, message: `Đã nhập thành công ${count} tài khoản mới!` });
    }

    if (action === "changePassword") {
      const { username, newPassword } = data;
      const data1 = sheet1.getDataRange().getValues();
      for (let i = 1; i < data1.length; i++) {
        if (String(data1[i][2]) === String(username)) {
          sheet1.getRange(i + 1, 4).setValue(newPassword);
          return jsonRes({ success: true, message: "Đã đổi mật khẩu thành công!" });
        }
      }
      return jsonRes({ success: false, message: "Lỗi khi đổi mật khẩu." });
    }

    if (action === "addNews") {
      const { title, type, content, fileBase64, fileMimeType, fileName } = data;
      let finalContent = content;
      if (type === "PDF" && fileBase64) {
        try {
          const targetFolderStr = "BaoCaoAnToanHocDuong";
          let folders = DriveApp.getFoldersByName(targetFolderStr);
          let folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(targetFolderStr);
          const blob = Utilities.newBlob(Utilities.base64Decode(fileBase64), fileMimeType, fileName);
          const file = folder.createFile(blob);
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          finalContent = file.getUrl();
        } catch (err) {
          // Fallback if drive fails
        }
      }
      sheet3.appendRow([title, finalContent, type, new Date().toISOString()]);
      return jsonRes({ success: true, message: "Đăng bài viết thành công!" });
    }

    if (action === "getNews") {
      const data3 = sheet3.getDataRange().getValues();
      const result = [];
      for(let i=1; i<data3.length; i++) {
        const row = data3[i];
        if (row[0]) {
          result.push({
              id: i + 1,
              title: row[0],
              content: row[1],
              type: row[2],
              time: row[3]
          });
        }
      }
      return jsonRes({ success: true, news: result.reverse() });
    }

    if (action === "deleteNews") {
      const { id } = data;
      if (id) {
        sheet3.deleteRow(Number(id));
        return jsonRes({ success: true, message: "Đã xóa bài viết thành công!" });
      }
      return jsonRes({ success: false, message: "Thiếu ID bài viết." });
    }

    if (action === "deleteAllNews") {
      const lastRow = sheet3.getLastRow();
      if (lastRow > 1) {
        sheet3.deleteRows(2, lastRow - 1);
      }
      return jsonRes({ success: true, message: "Đã xóa toàn bộ bài viết!" });
    }

    return jsonRes({ success: false, message: "Hành động không hợp lệ." });
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
