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
async function sendWelcomeEmail(email, displayName) {
    const mailOptions = {
        from: `"Vibe Coding" <${process.env.MAIL_USER}>`,
        to: email,
        subject: '歡迎加入 Vibe Coding！',
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #4A90E2;">歡迎來到 Vibe Coding！</h2>
                <p>Hi ${displayName || '開發者'},</p>
                <p>感謝您註冊 Vibe Coding。我們很高興能與您一起探索程式開發的樂趣！</p>
                <p>您可以立即開始您的學習之旅，這裡有一些免費的入門課程供您嘗試：</p>
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

module.exports = {
    sendWelcomeEmail,
    sendPaymentSuccessEmail,
    sendTrialExpiringEmail,
    sendCourseExpiringEmail,
    sendAssignmentNotification
};

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
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p><strong>作業名稱：</strong> ${assignmentTitle}</p>
                    <p><strong>繳交時間：</strong> ${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</p>
                </div>
                <p>請前往儀表板進行批改：</p>
                <p>
                    <a href="${assignmentUrl || 'https://vibe-coding.tw/dashboard'}" style="background-color: #4A90E2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">前往批改</a>
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
