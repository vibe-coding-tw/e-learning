const nodemailer = require('nodemailer');

// Configure Nodemailer Transport
// We rely on environment variables for credentials
const transporter = nodemailer.createTransport({
    service: 'gmail', // Or use 'smtp.gmail.com' directly
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

/**
 * Send a welcome email to a newly registered user.
 * @param {string} email - User's email address
 * @param {string} displayName - User's display name
 */
async function sendWelcomeEmail(email, displayName, expiryDateStr) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '歡迎加入 Vibe Coding！',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4A90E2;">歡迎來到 Vibe Coding！</h2>
                <p>Hi ${displayName || '開發者'},</p>
                <p>感謝您註冊 Vibe Coding。我們很高興能與您一起探索程式開發的樂趣！</p>
                
                <div style="background-color: #f0f7ff; border-left: 4px solid #4A90E2; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold; color: #4A90E2;">🎁 限時歡迎禮：入門課程免費使用一個月</p>
                    <p style="margin: 10px 0 0 0;">為了慶祝您加入，目前所有標記為<strong>「入門」</strong>的課程，您皆可免費存取使用至：</p>
                    <p style="margin: 5px 0 0 0; font-size: 18px; font-weight: bold; color: #E74C3C;">${expiryDateStr}</p>
                </div>

                <p>您可以立即開始您的學習之旅：</p>
                <p>
                    <a href="https://vibe-coding.tw/courses" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">開始學習</a>
                </p>
                <p>如果您有任何問題，隨時回覆這封郵件。</p>
                <br>
                <p>祝學習愉快！<br>Vibe Coding 團隊</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${email}`);
    } catch (error) {
        console.error('Error sending welcome email:', error);
    }
}

/**
 * Send a payment confirmation email.
 * @param {string} email - User's email address
 * @param {string} orderId - Order ID
 * @param {number} amount - Total amount paid
 * @param {string} itemsDesc - Description of items purchased
 */
async function sendPaymentSuccessEmail(email, orderId, amount, itemsDesc) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: 'Vibe Coding 訂單確認',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #2ECC71;">付款成功！</h2>
                <p>感謝您的購買。您的訂單已確認。</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>訂單編號：</strong> ${orderId}</p>
                    <p><strong>購買項目：</strong> ${itemsDesc}</p>
                    <p><strong>金額：</strong> TWD $${amount}</p>
                </div>
                <p>您現在可以隨時登入平台存取您的課程內容。</p>
                <p>
                    <a href="https://vibe-coding.tw/dashboard" style="background-color: #2ECC71; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">前往儀表板</a>
                </p>
                <br>
                <p>謝謝！<br>Vibe Coding 團隊</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Payment success email sent to ${email} for order ${orderId}`);
    } catch (error) {
        console.error('Error sending payment email:', error);
    }
}

/**
 * Send a trial expiration warning email.
 * @param {string} email - User's email address
 * @param {string} displayName - User's name
 * @param {number} daysLeft - Days remaining in trial
 */
async function sendTrialExpiringEmail(email, displayName, daysLeft) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `您的試用期即將在 ${daysLeft} 天後結束`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #E67E22;">試用期即將結束</h2>
                <p>Hi ${displayName || '開發者'},</p>
                <p>提醒您，您的 Vibe Coding 入門試用資格即將在 <strong>${daysLeft} 天</strong>後到期。</p>
                <p>希望您在這些課程中收穫滿滿！如果您希望繼續存取這些內容或解鎖更多進階課程，請考慮升級您的帳戶。</p>
                <p>
                    <a href="https://vibe-coding.tw/courses" style="background-color: #E67E22; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">查看課程方案</a>
                </p>
                <br>
                <p>Vibe Coding 團隊</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Trial expiring email sent to ${email}`);
    } catch (error) {
        console.error('Error sending trial email:', error);
    }
}

/**
 * Send a course expiration warning email.
 * @param {string} email - User's email address
 * @param {string} displayName - User's name
 * @param {string} courseName - Name of the course
 * @param {number} daysLeft - Days remaining
 */
async function sendCourseExpiringEmail(email, displayName, courseName, daysLeft) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `[提醒] 您的課程 "${courseName}" 即將在 ${daysLeft} 天後到期`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #E74C3C;">課程使用期限提醒</h2>
                <p>Hi ${displayName || '開發者'},</p>
                <p>提醒您，您的課程 <strong>${courseName}</strong> 的使用期限即將在 <strong>${daysLeft} 天</strong>後到期。</p>
                <p>把握最後的時間複習課程內容！如果您希望繼續存取，請考慮購買續約或查看最新優惠。</p>
                <p>
                    <a href="https://vibe-coding.tw/dashboard" style="background-color: #E74C3C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">登入儀表板</a>
                </p>
                <br>
                <p>Happy Coding!<br>Vibe Coding 團隊</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Course expiring email sent to ${email} for course ${courseName}`);
    } catch (error) {
        console.error('Error sending course expiring email:', error);
    }
}

/**
 * Send an email to a newly authorized teacher.
 * @param {string} email - Teacher's email address
 * @param {string} courseId - The course they are authorized for
 */
async function sendTeacherAuthorizationEmail(email, unitName, unitId) {
    const cleanUnitId = unitId ? unitId.replace('.html', '') : '';
    const dashboardUrl = cleanUnitId ? `https://vibe-coding.tw/dashboard.html?unitId=${cleanUnitId}` : `https://vibe-coding.tw/dashboard.html`;

    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `Vibe Coding 課程單元授權通知: ${unitName}`,
        text: `恭喜您成為 Vibe Coding 授權教師！\n\n您已獲得課程單元 "${unitName}" 的管理權限。\n\n請前往教師儀表板開始管理：\n${dashboardUrl}\n\nHappy Teaching!\nVibe Coding Team`,
        html: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #4A90E2;">恭喜您成為 Vibe Coding 授權教師！</h2>
                <p>Hi,</p>
                <p>您已獲得課程單元 <strong>${unitName}</strong> 的授權。現在可以存取教師資源與管理功能。</p>
                
                <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 0;"><strong>下一步：</strong></p>
                    <ul style="margin: 10px 0;">
                        <li>登入教師儀表板獲取 GitHub Classroom 連結</li>
                        <li>確認範本倉庫內容</li>
                    </ul>
                </div>

                <p><a href="${dashboardUrl}" style="display: inline-block; background: #4A90E2; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">前往教師儀表板</a></p>
                <p>若無法點擊連結，請複製此網址：<br>${dashboardUrl}</p>
                <p>Happy Teaching!<br>Vibe Coding Team</p>
            </div>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Teacher authorization email sent to ${email} for unit ${unitId}. MessageId: ${info.messageId}`);
    } catch (error) {
        console.error('Error sending teacher authorization email:', error);
    }
}

/**
 * Send an assignment submission notification to the teacher/admin.
 * @param {string} teacherEmail - Teacher's email address
 * @param {string} studentName - Student's display name
 * @param {string} assignmentTitle - Title of the assignment
 * @param {string} assignmentUrl - Link to the assignment or dashboard
 */
async function sendAssignmentNotification(teacherEmail, studentName, assignmentTitle, assignmentUrl) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: teacherEmail,
        subject: `[作業繳交] ${studentName} 繳交了 "${assignmentTitle}"`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4A90E2;">收到新的作業！</h2>
                <p>Hi 老師,</p>
                <p>學生 <strong>${studentName}</strong> 剛剛繳交了作業：</p>
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 8px; margin: 20px 0; border: 1px solid #eee;">
                    <p><strong>作業名稱：</strong> ${assignmentTitle}</p>
                    <p><strong>繳交時間：</strong> ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                </div>
                
                <div style="background-color: #fff9db; border-left: 4px solid #fcc419; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold; color: #856404;">💡 教學互動建議</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">除了批改分數，給予深入的具體反饋能幫助學生更快進步。良好的師生互動是持續學習的最佳動力！</p>
                </div>

                <p>請前往儀表板進行批閱：</p>
                <p>
                    <a href="${assignmentUrl || 'https://vibe-coding.tw/dashboard'}" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">前往批改</a>
                </p>
                <br>
                <p>Vibe Coding System</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Assignment notification sent to ${teacherEmail}`);
    } catch (error) {
        console.error('Error sending assignment notification:', error);
    }
}

/**
 * Send an email to the student when their assignment is graded.
 * @param {string} email - Student's email
 * @param {string} studentName - Student's name
 * @param {string} assignmentTitle - Assignment title
 * @param {number} grade - Grade received
 * @param {string} feedback - Teacher's feedback
 */
async function sendGradingNotification(email, studentName, assignmentTitle, grade, feedback) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `[作業評改] 老師已評回您的作業 "${assignmentTitle}"`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                <h2 style="color: #2ECC71;">作業已完成評閱！</h2>
                <p>Hi ${studentName},</p>
                <p>老師已經看過您繳交的 <strong>${assignmentTitle}</strong> 並給予了回饋。</p>
                
                <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #eee;">
                    <p><strong>分數：</strong> <span style="font-size: 18px; color: #2ECC71; font-weight: bold;">${grade}</span></p>
                    <p><strong>老師的話：</strong><br>${feedback || '做得好！繼續加油。'}</p>
                </div>

                <div style="background-color: #e7f3ff; border-left: 4px solid #4A90E2; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold; color: #004085;">🤝 建立良好的師生互動</p>
                    <p style="margin: 10px 0 0 0; font-size: 14px;">對評語或課程有疑問嗎？歡迎透過平台的功能或 Email 向老師提問。保持積極的溝通能讓您的學習更有效率！</p>
                </div>

                <p>您可以前往儀表板查看詳細的作業紀錄：</p>
                <p>
                    <a href="https://vibe-coding.tw/dashboard" style="background-color: #2ECC71; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">查看作業詳情</a>
                </p>
                <br>
                <p>持續前進！<br>Vibe Coding 團隊</p>
            </div>
        `
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Grading notification sent to ${email}`);
    } catch (error) {
        console.error('Error sending grading notification:', error);
    }
}

/**
 * Send an email to the student when they are assigned a teacher for a unit.
 */
async function sendStudentLinkedToTeacherEmail(email, studentName, unitId, teacherEmail) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `[課程通知] 您的單元 "${unitId}" 已指派指導老師`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                <h2 style="color: #4A90E2;">老師來囉！</h2>
                <p>Hi ${studentName},</p>
                <p>我們已為您的課程單元 <strong>${unitId}</strong> 指派了專屬指導老師：</p>
                <div style="background-color: #f0f7ff; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #d0e7ff;">
                    <p style="margin: 0;"><strong>指導老師：</strong> ${teacherEmail}</p>
                </div>
                <p>在學習過程中若有任何疑問，或完成作業後需要批改，老師都會全程協助您。鼓勵您主動與老師保持聯繫，祝您學習愉快！</p>
                <p>
                    <a href="https://vibe-coding.tw/dashboard" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">前往儀表板</a>
                </p>
                <br>
                <p>Vibe Coding 團隊</p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending student relationship email:', error);
    }
}

/**
 * Send an email to the teacher when a student is assigned to them.
 */
async function sendTeacherLinkedToStudentEmail(email, studentName, unitId) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: `[教學任務] 新學生 ${studentName} 已指派給您 (${unitId})`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333; line-height: 1.6;">
                <h2 style="color: #4A90E2;">新的教學任務</h2>
                <p>老師您好，</p>
                <p>學生 <strong>${studentName}</strong> 已被指派給您進行單元 <strong>${unitId}</strong> 的指導。</p>
                <div style="background-color: #fff9db; border-left: 4px solid #fcc419; padding: 15px; margin: 20px 0;">
                    <p style="margin: 0; font-weight: bold; color: #856404;">💡 互動提醒</p>
                    <p style="margin: 5px 0 0 0; font-size: 14px;">請隨時關注這位學生的學習進度與作業繳交狀況，並透過積極的正向回饋建立良好的教學互動關係。</p>
                </div>
                <p>
                    <a href="https://vibe-coding.tw/dashboard" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">開啟教師後台</a>
                </p>
                <br>
                <p>Vibe Coding 教務系統</p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending teacher relationship email:', error);
    }
}

/**
 * Send a summary email to the admin about pending student assignments.
 */
async function sendAdminAssignmentReminder(adminEmail, pendingList) {
    const listHtml = pendingList.map(item => `
        <li style="margin-bottom: 10px;">
            <strong>${item.email}</strong> 購買了: <em>${item.units.join(', ')}</em>
        </li>
    `).join('');

    const mailOptions = {
        from: `"Vibe Coding System" <${process.env.MAIL_USER}>`,
        to: adminEmail,
        subject: `[每日提醒] 尚有 ${pendingList.length} 位學生等待指派老師`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #E74C3C;">待處理的課程指派任務</h2>
                <p>管理員您好，系統掃描到以下已付費學生尚未完成所有課程單元的老師指派：</p>
                <ul style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; list-style-type: none; border: 1px solid #eee;">
                    ${listHtml}
                </ul>
                <p>請撥冗前往儀表板完成指派，以確保學生的學習權益與教學互動品質。</p>
                <p>
                    <a href="https://vibe-coding.tw/dashboard" style="background-color: #E74C3C; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">前往後台處理</a>
                </p>
                <br>
                <p>Vibe Coding 自動化管家</p>
            </div>
        `
    };
    try {
        await transporter.sendMail(mailOptions);
    } catch (error) {
        console.error('Error sending admin reminder email:', error);
    }
}

module.exports = {
    sendWelcomeEmail,
    sendPaymentSuccessEmail,
    sendTrialExpiringEmail,
    sendCourseExpiringEmail,
    sendAssignmentNotification,
    sendTeacherAuthorizationEmail,
    sendGradingNotification,
    sendStudentLinkedToTeacherEmail,
    sendTeacherLinkedToStudentEmail,
    sendAdminAssignmentReminder
};
