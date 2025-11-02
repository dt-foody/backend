const BaseController = require('../utils/_base.controller.js');
const { userService } = require('../services/index.js');

class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  // POST /api/users/me/change-password
  async changePassword(req, res, next) {
    try {
      const userId = req.user?.id;
      console.log('Changing password for userId:', userId);
      if (!userId) return res.status(401).json({ message: 'UNAUTHORIZED' });

      const { currentPassword, newPassword, confirmNewPassword } = req.body || {};
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        return res.status(400).json({ message: 'currentPassword, newPassword, confirmNewPassword are required' });
      }
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ message: 'Password confirmation does not match' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters' });
      }

      const result = await this.service.changePassword(userId, currentPassword, newPassword);
      return res.status(200).json({ message: 'Password changed', tokenVersion: result.tokenVersion });
    } catch (err) {
      if (err.message === 'USER_NOT_FOUND')           return res.status(404).json({ message: 'User not found' });
      if (err.message === 'CURRENT_PASSWORD_INCORRECT')return res.status(400).json({ message: 'Current password is incorrect' });
      if (err.message === 'PASSWORD_REUSED')           return res.status(400).json({ message: 'New password must be different from the old one' });
      return next(err);
    }
  }
}

module.exports = new UserController();
